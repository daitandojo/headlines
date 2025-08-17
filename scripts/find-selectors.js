// scripts/find-selectors.js (version 10.11 - The Definitive Defensive Sanitizer)
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import readline from 'readline';
import playwright from 'playwright';
import client from '../src/modules/ai/client.js';
import { LLM_MODEL } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

// --- Configuration ---
// const PAPERS_CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'papers.json');
const PAPERS_CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'PEFirms.json');

const DEBUG_DIR = path.join(process.cwd(), 'debug');
const STORAGE_STATE_PATH = path.join(process.cwd(), 'debug', 'state.json');
const MIN_HEADLINES_THRESHOLD = 8;
const MIN_ARTICLE_LENGTH_THRESHOLD = 500;
const SAVE_HTML_FLAG = process.argv.includes('--save-html') || true;
const NO_HEADLESS_FLAG = process.argv.includes('--no-headless');

const colors = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", grey: "\x1b[90m" };
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// --- Helper & Utility Functions ---
function pause() { return new Promise(resolve => rl.question(`\n${colors.yellow}Press Enter to continue...${colors.reset}`, () => resolve())); }

async function saveDebugHtml(filename, html) {
    if (!SAVE_HTML_FLAG) return;
    try {
        await fs.mkdir(DEBUG_DIR, { recursive: true });
        const filePath = path.join(DEBUG_DIR, filename);
        await fs.writeFile(filePath, html);
        logger.info(`${colors.grey}Saved HTML snapshot to ${filePath}${colors.reset}`);
    } catch (error) { logger.error(`Failed to save debug HTML: ${error.message}`); }
}

// --- CORE FIX: The truly defensive URL sanitizer ---
function sanitizeUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') {
        logger.warn('  -> sanitizeUrl received an invalid input.');
        return null;
    }

    let cleanUrl = url.trim();

    // Fix specific typo from JSON-LD data: "https//..." -> "https://..."
    if (cleanUrl.startsWith('https//')) {
        cleanUrl = 'https://' + cleanUrl.substring(7);
    }
    
    // Fix protocol-relative URLs
    if (cleanUrl.startsWith('//')) {
        cleanUrl = new URL(baseUrl).protocol + cleanUrl;
    }

    // Fix malformed URLs from previous bad runs that might be in the config file
    const lastHttp = cleanUrl.lastIndexOf('http');
    if (lastHttp > 0) {
        cleanUrl = cleanUrl.substring(lastHttp);
        logger.warn(`${colors.yellow}  -> Corrected a concatenated URL. Using: "${cleanUrl}"${colors.reset}`);
    }

    try {
        // If cleanUrl is now a full URL, baseUrl will be ignored.
        // If cleanUrl is a relative path (e.g., /economie/article), it will be correctly joined.
        return new URL(cleanUrl, baseUrl).href;
    } catch (e) {
        logger.error(`  -> Unrecoverable URL sanitization failure for: "${url}"`);
        return null;
    }
}


// --- Agentic Browser & AI Functions ---
async function findAndClickConsentButton(page) {
    logger.info(`> Probing for consent button...`);
    await page.waitForTimeout(2000);

    const commonAcceptTexts = [ 'Akkoord', 'Accepteer alles', 'Alles accepteren', 'Ja, ik accepteer', 'Accepteren', 'Accept all', 'Agree', 'I accept', 'Aksepter' ];
    
    for (const text of commonAcceptTexts) {
        try {
            const button = page.getByRole('button', { name: text, exact: false }).first();
            if (await button.isVisible({ timeout: 1000 })) {
                logger.info(`${colors.green}  -> Found and clicked consent button: "${text}"${colors.reset}`);
                await button.click();
                return true;
            }
        } catch (e) { /* Ignore */ }
    }
    logger.info(`${colors.grey}  -> No common consent button was found or clicked.${colors.reset}`);
    return false;
}

async function getPageHtmlWithPlaywright(url, outletName, country) {
    logger.info(`> Deploying browser agent to: ${colors.cyan}${url}${colors.reset}`);
    const browser = await playwright.chromium.launch({ headless: !NO_HEADLESS_FLAG });
    
    let context;
    try {
        context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
        logger.info(`  -> Loaded existing browser state from ${STORAGE_STATE_PATH}`);
    } catch (e) {
        logger.warn(`  -> Could not load browser state, starting fresh.`);
        context = await browser.newContext();
    }

    const page = await context.newPage();
    
    try {
        logger.info(`  -> Navigating to URL...`);
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        logger.info(`  -> Page loaded. Current URL: ${page.url()}`);

        const originalHostname = new URL(url).hostname;
        const currentHostname = new URL(page.url()).hostname;

        if (!currentHostname.includes(originalHostname)) {
            logger.warn(`${colors.yellow}  -> Redirected to cross-domain consent manager: ${currentHostname}${colors.reset}`);
            
            const consentButtonClicked = await findAndClickConsentButton(page);

            if (consentButtonClicked) {
                await page.waitForLoadState('networkidle', { timeout: 10000 });
                logger.info(`  -> Consent action processed. Navigating back to original URL...`);
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                logger.info(`${colors.green}  -> Successfully re-loaded original page with consent.${colors.reset}`);
            }
        } else {
             logger.info(`  -> Successfully loaded page without consent redirect.`);
        }
        
        await context.storageState({ path: STORAGE_STATE_PATH });
        logger.info(`  -> Browser state (cookies) saved to ${STORAGE_STATE_PATH}`);

        const html = await page.content();
        await saveDebugHtml(`${outletName.replace(/[^a-z0-9]/gi, '_')}.html`, html);
        return { html, status: response?.status() || 200 };
    } catch (error) {
        logger.error(`  -> Agent failed during navigation: ${error.message.split('\n')[0]}`);
        return { html: null, status: null };
    } finally {
        await browser.close();
    }
}


async function findBusinessUrlWithAI(html, baseUrl, country) {
    logger.info(`> AI Task: Finding the business/news section URL...`);
    const $ = cheerio.load(html);
    const links = [];
    $('nav a, header a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (text && href) { try { links.push({ text, url: new URL(href, baseUrl).href }); } catch(e){} }
    });
    if (links.length === 0) { logger.warn(`  -> Could not find any navigation links to analyze.`); return null; }
    
    logger.info(`  -> Found ${links.length} candidate links for AI analysis.`);
    const sysPrompt = `You are a multilingual media analyst. From this JSON of navigation links from a news website in ${country}, identify the single URL that most likely leads to the main "News", "Latest News", "Business", or "Economy" section. Respond ONLY with a valid JSON object: { "best_url": "the-full-url", "reasoning": "Your brief reasoning." }`;
    try {
        const res = await client.chat.completions.create({ model: LLM_MODEL, messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: JSON.stringify(links) }], response_format: { type: 'json_object' } });
        const { best_url, reasoning } = JSON.parse(res.choices[0].message.content);
        logger.info(`${colors.green}  -> AI identified best section URL: ${best_url}${colors.reset}`);
        logger.info(`${colors.grey}     AI Reasoning: ${reasoning}${colors.reset}`);
        return best_url;
    } catch (e) {
        logger.error(`  -> AI URL discovery failed: ${e.message}`);
        return null;
    }
}

// --- Core Analysis Pipeline (Unchanged) ---
function analyzeHtmlStructure(html) {
    logger.info(`> Performing intelligent HTML structure analysis...`);
    const $ = cheerio.load(html);
    
    const totalLinks = $('a[href]').length;
    const totalElements = $('*').length;
    logger.info(`  -> HTML contains ${totalElements} total elements, ${totalLinks} links with href`);
    
    if (totalLinks < 20) {
        logger.warn(`${colors.yellow}  -> WARNING: Very few links found. The page might be a loader or privacy gate.${colors.reset}`);
        const bodyPreview = $('body').text().replace(/\s+/g, ' ').trim();
        logger.info(`${colors.grey}  -> Body Text Preview: ${bodyPreview.substring(0, 400)}...${colors.reset}`);
    }

    $('nav, footer, header, aside, .ad, .advert, .cookie, .privacy, script, style, noscript').remove();
    logger.info(`  -> Cleaned HTML by removing common non-content sections.`);
    
    const linkAnalysis = [];
    
    $('a[href]').each((index, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            return;
        }

        let prominentText = $el.find('.ankeiler__title, .teaser__title, h1, h2, h3, h4, b, strong').first().text();
        if (!prominentText) {
             prominentText = $el.text();
        }
        prominentText = prominentText.replace(/\s+/g, ' ').trim();
        
        if (prominentText.length >= 15 && prominentText.length <= 200) {
            linkAnalysis.push({
                text: prominentText,
                href,
                selector: generateOptimalSelector($, $el)
            });
        }
    });
    
    logger.info(`  -> Analysis complete: ${linkAnalysis.length} potential headline links identified after filtering.`);
    return linkAnalysis;
}

function generateOptimalSelector($, element) {
    const $el = $(element);
    const classes = $el.attr('class');
    const id = $el.attr('id');
    const tag = $el.prop('tagName')?.toLowerCase();
    
    if (id) return `#${id}`;
    
    if (classes) {
        const classList = classes.split(' ').filter(Boolean);
        const semanticClasses = classList.filter(cls => 
            /headline|title|link|teaser|story|article|ankeiler/i.test(cls)
        );
        if (semanticClasses.length > 0) {
            return `.${semanticClasses[0]}`;
        }
    }
    
    const dataAttrs = Object.keys($el[0].attribs || {}).filter(attr => attr.startsWith('data-'));
    if (dataAttrs.length > 0) {
        const semanticData = dataAttrs.find(attr => /category|type|content|gtm/i.test(attr));
        if (semanticData) {
            return `${tag}[${semanticData}]`;
        }
    }
    
    if (classes) {
        return `${tag}.${classes.split(' ')[0]}`;
    }
    
    return tag;
}

async function identifyHeadlinesWithAI(linkAnalysis, baseUrl, country) {
    logger.info(`> AI Task: Analyzing ${linkAnalysis.length} links to identify headlines...`);
    
    if (linkAnalysis.length === 0) return { headlines: [], method: 'No links found', selector: null };
    
    const analysisData = linkAnalysis.slice(0, 100).map(link => ({
        text: link.text,
        href: link.href,
        selector: link.selector
    }));
    
    const sysPrompt = `You are an expert web scraping analyst. Analyze this JSON array of links from a news website in ${country}. Your task is to identify which links are most likely to be NEWS HEADLINES (not navigation, ads, or utility links).

Consider these factors:
- Headline text content and length.
- URL structure.
- The CSS selector associated with the link.

Respond with a JSON object containing:
{
  "headline_links": [
    {
      "text": "The headline text",
      "href": "the-url",
      "reasoning": "Why this is likely a headline",
      "confidence": 0.95
    }
  ],
  "pattern_analysis": "Description of the common pattern you identified for headlines",
  "recommended_selector": "A robust CSS selector that would capture these headlines, e.g., 'a.story-link' or 'article h3 a'"
}

Select the TOP 15-25 most likely headlines, prioritizing quality over quantity.`;

    try {
        const res = await client.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: JSON.stringify(analysisData) }
            ],
            response_format: { type: 'json_object' }
        });
        
        const analysis = JSON.parse(res.choices[0].message.content);
        
        logger.info(`${colors.green}  -> AI identified ${analysis.headline_links?.length || 0} headlines${colors.reset}`);
        logger.info(`${colors.grey}     Pattern: ${analysis.pattern_analysis}${colors.reset}`);
        logger.info(`${colors.grey}     Recommended selector: ${analysis.recommended_selector}${colors.reset}`);
        
        if (analysis.headline_links && analysis.headline_links.length > 0) {
            const headlines = analysis.headline_links.map(link => ({
                headline: link.text,
                link: sanitizeUrl(link.href, baseUrl)
            })).filter(h => h.link);
            
            return {
                headlines,
                method: 'AI Structural Analysis',
                selector: analysis.recommended_selector || 'AI-identified pattern',
                aiAnalysis: {
                    pattern: analysis.pattern_analysis,
                    confidence: analysis.headline_links.map(h => h.confidence).reduce((a, b) => a + b, 0) / (analysis.headline_links.length || 1)
                }
            };
        }
    } catch (e) {
        logger.error(`  -> AI analysis failed: ${e.message}`);
    }
    
    return null;
}

async function tryJsonLdExtraction(html, baseUrl) {
    logger.info(`  -> Trying golden path (JSON-LD structured data)...`);
    const $ = cheerio.load(html);
    let ldJsonHeadlines = [];
    
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const jsonString = $(el).html();
            if (!jsonString) return;
            
            const data = JSON.parse(jsonString);
            const items = data.itemListElement || 
                         (data['@graph'] && data['@graph'].find(item => item.itemListElement)?.itemListElement) || 
                         (Array.isArray(data) && data.find(i => i.itemListElement)?.itemListElement);
            
            if (items && Array.isArray(items)) {
                items.forEach(item => {
                    const headline = item.name || item.item?.name;
                    const url = item.url || item.item?.url;
                    if (headline && url) {
                        const finalUrl = sanitizeUrl(url, baseUrl);
                        if (finalUrl) {
                            ldJsonHeadlines.push({ headline: headline.replace(/\s+/g, ' ').trim(), link: finalUrl });
                        }
                    }
                });
            }
        } catch(e) { 
            logger.warn(`${colors.yellow}  -> Warning: Failed to parse JSON-LD block${colors.reset}`);
        }
    });
    
    if (ldJsonHeadlines.length >= MIN_HEADLINES_THRESHOLD) {
        logger.info(`${colors.green}  -> Golden path SUCCESS! Found ${ldJsonHeadlines.length} headlines in JSON-LD${colors.reset}`);
        return { headlines: ldJsonHeadlines, method: 'JSON-LD', selector: 'script[type="application/ld+json"]' };
    }
    
    return null;
}

async function getHeadlineData(html, baseUrl, country) {
    logger.info(`> Stage 2: Intelligent headline detection...`);
    
    const jsonLdResult = await tryJsonLdExtraction(html, baseUrl);
    if (jsonLdResult) return jsonLdResult;
    
    logger.info(`${colors.yellow}  -> Golden path failed. Analyzing HTML structure...${colors.reset}`);
    
    const linkAnalysis = analyzeHtmlStructure(html);
    
    if (linkAnalysis.length < MIN_HEADLINES_THRESHOLD) {
        logger.error(`  -> Not enough analyzable links found in HTML (${linkAnalysis.length}). Aborting analysis for this source.`);
        return null;
    }
    
    const aiResult = await identifyHeadlinesWithAI(linkAnalysis, baseUrl, country);
    
    if (aiResult && aiResult.headlines.length >= MIN_HEADLINES_THRESHOLD) {
        logger.info(`${colors.green}  -> AI analysis SUCCESS!${colors.reset}`);
        return aiResult;
    } else if (aiResult && aiResult.headlines.length > 0) {
        logger.warn(`${colors.yellow}  -> AI found ${aiResult.headlines.length} headlines (below threshold of ${MIN_HEADLINES_THRESHOLD})${colors.reset}`);
        return aiResult;
    }
    
    logger.error(`  -> All headline detection methods failed`);
    return null;
}

async function getArticleData(url, outletName, country, learnedSelectors) {
    logger.info(`> Stage 3: Analyzing article content...`);
    const { html } = await getPageHtmlWithPlaywright(url, `${outletName}_article`, country);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    logger.info(`  -> Performing intelligent content analysis...`);
    
    const contentAnalysis = [];
    
    const potentialSelectors = [
        'article p', 'main p', '.content p', '.article-body p', '.post-content p',
        'div[class*="content"] p', 'div[class*="body"] p', 'div[class*="text"] p',
        '.story-body p', '.article-text p', 'meta[name="description"]'
    ];
    
    if (learnedSelectors && learnedSelectors.length > 0) {
        potentialSelectors.unshift(...learnedSelectors);
    }
    
    for (const selector of potentialSelectors) {
        try {
            let text = '';
            if (selector.startsWith('meta')) {
                text = $(selector).attr('content') || '';
            } else {
                text = $(selector).map((_, el) => $(el).text().trim()).get().join(' ').replace(/\s+/g, ' ');
            }
            
            if (text.length > 0) {
                contentAnalysis.push({
                    selector,
                    text,
                    length: text.length,
                    paragraphs: selector.includes('meta') ? 1 : $(selector).length
                });
            }
        } catch (e) { /* Skip invalid selectors */ }
    }
    
    contentAnalysis.sort((a, b) => b.length - a.length);
    
    if (contentAnalysis.length > 0 && contentAnalysis[0].length >= MIN_ARTICLE_LENGTH_THRESHOLD) {
        logger.info(`${colors.green}  -> Found article content (${contentAnalysis[0].length} chars) using selector: ${contentAnalysis[0].selector}${colors.reset}`);
        return {
            selector: contentAnalysis[0].selector,
            text: contentAnalysis[0].text,
            method: 'Intelligent Content Analysis'
        };
    }
    
    logger.warn(`  -> Using fallback full-page text extraction...`);
    $('nav, header, footer, aside, .sidebar, .comments, .ads, script, style, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    
    if (bodyText.length >= MIN_ARTICLE_LENGTH_THRESHOLD) {
        return {
            selector: 'body.cleaned',
            text: bodyText,
            method: 'Full-Page Text Extraction'
        };
    }
    
    return null;
}

async function analyzeOutlet(outlet, learnedSelectors) {
    console.log(`\n\n======================================================================`);
    console.log(`${colors.yellow}🔍 ANALYZING: ${outlet.name} (${outlet.country})${colors.reset}`);
    console.log(`======================================================================`);
    
    logger.info(`> Stage 1: Locating content page...`);
    let finalUrl = outlet.url;
    let urlDiscoveryMethod = 'initial';
    let { html, status } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country);

    if (status === 404) {
        logger.warn(`  -> Initial URL returned 404. Attempting root domain analysis...`);
        urlDiscoveryMethod = 'AI-discovered';
        const rootUrl = new URL(finalUrl).origin;
        const rootResult = await getPageHtmlWithPlaywright(rootUrl, `${outlet.name}_root`, outlet.country);
        
        if (rootResult.html) {
            const correctedUrl = await findBusinessUrlWithAI(rootResult.html, rootUrl, outlet.country);
            if (correctedUrl) {
                finalUrl = correctedUrl;
                ({ html } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country));
            } else { html = null; }
        } else { html = null; }
    }

    if (!html) {
        console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not retrieve valid page content for ${finalUrl}${colors.reset}`);
        return null;
    }

    const headlineData = await getHeadlineData(html, finalUrl, outlet.country);
    if (!headlineData) {
        console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not identify headline pattern${colors.reset}`);
        return null;
    }

    const firstArticleUrl = headlineData.headlines[0]?.link;
    if (!firstArticleUrl) {
        logger.error(`❌ No valid article URLs found in headlines`);
        return null;
    }
    
    const sanitizedArticleUrl = sanitizeUrl(firstArticleUrl, finalUrl);
    if(!sanitizedArticleUrl) {
        logger.error(`❌ Could not sanitize the first article URL: ${firstArticleUrl}`);
        return null;
    }

    const articleData = await getArticleData(sanitizedArticleUrl, outlet.name, outlet.country, learnedSelectors.articles);

    const analysisResult = {
        urlDiscoveryMethod,
        finalUrl,
        technology: 'playwright + AI',
        headlineSelectorMethod: headlineData.method,
        headlineSelector: headlineData.selector,
        headlinesFound: headlineData.headlines.length,
        firstArticleUrl: sanitizedArticleUrl,
        articleContentSelector: articleData ? articleData.selector : null,
        sampleArticleLength: articleData ? articleData.text.length : 0,
        aiInsights: headlineData.aiAnalysis || null,
        notes: `Handled consent using persistent browser state.`
    };

    console.log(`\n--- ✅ CONFIGURATION DISCOVERED FOR: ${outlet.name} ---`);
    console.log(JSON.stringify(analysisResult, null, 2));
    console.log(`-----------------------------------------------------------\n`);

    return analysisResult;
}

async function main() {
    logger.info(`🚀 Starting Intelligent Source Configuration Agent (v10.11)...`);
    
    let allPapersData;
    try {
        const fileContent = await fs.readFile(PAPERS_CONFIG_PATH, 'utf-8');
        allPapersData = JSON.parse(fileContent);
    } catch (e) {
        logger.fatal(`${colors.red}Could not read papers.json: ${e.message}${colors.reset}`);
        return;
    }

    const learnedSelectors = generateLearnedSelectors(allPapersData);
    const outletsToProcess = getOutletsToProcess(allPapersData);
    
    if (!outletsToProcess || outletsToProcess.length === 0) {
        logger.info('✅ All outlets analyzed or none targeted.');
        rl.close();
        return;
    }

    for (const outlet of outletsToProcess) {
        const analysisResult = await analyzeOutlet(outlet, learnedSelectors);
        
        if (analysisResult) {
            const countryIndex = allPapersData.findIndex(c => `${c.flag_emoji} ${c.country}` === outlet.country);
            const outletIndex = allPapersData[countryIndex].outlets.findIndex(o => o.name === outlet.name);
            
            allPapersData[countryIndex].outlets[outletIndex] = {
                ...allPapersData[countryIndex].outlets[outletIndex],
                labCheckPerformed: true,
                url: analysisResult.finalUrl,
                analysis: analysisResult
            };

            try {
                await fs.writeFile(PAPERS_CONFIG_PATH, JSON.stringify(allPapersData, null, 2));
                logger.info(`${colors.green}✅ Saved configuration for ${outlet.name}${colors.reset}`);
            } catch (error) {
                logger.fatal(`${colors.red}CRITICAL: Failed to save papers.json! ${error.message}${colors.reset}`);
            }
        } else {
            logger.warn(`${colors.yellow}⚠️  Analysis unsuccessful for ${outlet.name} - will retry next run${colors.reset}`);
        }

        // if (outletsToProcess.length > 1 && outletsToProcess.indexOf(outlet) < outletsToProcess.length - 1) await pause();
    }

    logger.info('🎉 Analysis complete for all targeted outlets.');
    rl.close();
}

function generateLearnedSelectors(allPapersData) {
    const headlines = new Set();
    const articles = new Set();
    
    allPapersData.forEach(country => {
        country.outlets.forEach(outlet => {
            if (outlet.labCheckPerformed && outlet.analysis) {
                if (outlet.analysis.headlineSelector && !outlet.analysis.headlineSelector.includes('script')) {
                    headlines.add(outlet.analysis.headlineSelector);
                }
                if (outlet.analysis.articleContentSelector) {
                    articles.add(outlet.analysis.articleContentSelector);
                }
            }
        });
    });

    const learned = { headlines: Array.from(headlines), articles: Array.from(articles) };
    logger.info(`> Learning Phase: ${learned.headlines.length} headline + ${learned.articles.length} article selectors loaded`);
    return learned;
}

function getOutletsToProcess(allPapersData) {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    let allOutlets = allPapersData.flatMap(c => 
        c.outlets.map(o => ({...o, country: `${c.flag_emoji} ${c.country}`}))
    );

    if (args.length > 0) {
      const targetName = args.join(' ').toLowerCase();
      allOutlets = allOutlets.filter(o => o.name.toLowerCase().includes(targetName) || o.country.toLowerCase().includes(targetName));
    }

    const unprocessedOutlets = allOutlets.filter(o => 
        !o.labCheckPerformed || 
        !o.analysis?.articleContentSelector || 
        o.analysis?.sampleArticleLength < MIN_ARTICLE_LENGTH_THRESHOLD ||
        !o.analysis?.firstArticleUrl
    );

    if (unprocessedOutlets.length === 0 && allOutlets.length > 0) {
        logger.info(`Found ${allOutlets.length} matching outlet(s), but all appear to be analyzed. To re-run, set "labCheckPerformed" to false in papers.json.`);
        return [];
    }
    
    if (unprocessedOutlets.length === 0) {
        logger.info(`✅ All outlets have been successfully analyzed.`);
        return [];
    }

    logger.info(`Found ${unprocessedOutlets.length} unprocessed or incomplete outlet(s) to analyze.`);
    return unprocessedOutlets;
}

main().catch(e => { 
    logger.fatal('A critical error occurred:', e); 
    rl.close(); 
    process.exit(1); 
});