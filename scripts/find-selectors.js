// scripts/find-selectors.js (version 10.0 - Intelligent HTML Analysis)
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
const PAPERS_CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'papers.json');
const DEBUG_DIR = path.join(process.cwd(), 'debug');
const MIN_HEADLINES_THRESHOLD = 8;
const MIN_ARTICLE_LENGTH_THRESHOLD = 500;
const SAVE_HTML_FLAG = process.argv.includes('--save-html') || true; // Always save for debugging
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

function sanitizeUrl(url, baseUrl) {
    if (!url || typeof url !== 'string') return null;
    
    const lastHttp = url.lastIndexOf('http');
    if (lastHttp > 0) {
        const potentialUrl = url.substring(lastHttp);
        try {
            const corrected = new URL(potentialUrl).href;
            logger.info(`${colors.grey}  -> URL sanitizer recovered malformed URL: "${corrected}"${colors.reset}`);
            return corrected;
        } catch (e) { return null; }
    }
    
    try {
        return new URL(url, baseUrl).href;
    } catch (e) {
        return null;
    }
}

// --- Agentic Browser & AI Functions ---
async function findAndClickConsentButton(page, country) {
    logger.info(`> AI Task: Identifying consent button...`);
    const buttons = await page.evaluate(() => 
        Array.from(document.querySelectorAll('button, a[role="button"]'))
             .map(el => el.innerText.trim())
             .filter(text => text.length > 2 && text.length < 30)
    );
    
    if (buttons.length === 0) {
        logger.info(`${colors.grey}  -> No buttons found to analyze for consent.${colors.reset}`);
        return false;
    }
    
    const sysPrompt = `You are a web automation expert. From this JSON array of button texts from a website in ${country}, identify the SINGLE button text that accepts cookies, privacy, or consent. Prioritize clear "accept" actions (like 'Accept', 'Agree', 'OK') over ambiguous "settings" links. Respond ONLY with a valid JSON object: { "text_to_click": "The exact text of the button to click" } OR { "text_to_click": null }`;
    
    try {
        const res = await client.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: JSON.stringify(buttons) }
            ],
            response_format: { type: 'json_object' }
        });
        
        const { text_to_click } = JSON.parse(res.choices[0].message.content);
        if (text_to_click) {
            logger.info(`  -> AI advised clicking button: "${text_to_click}"`);
            await page.getByRole('button', { name: text_to_click, exact: true }).first().click({ timeout: 5000 });
            logger.info(`${colors.green}  -> Successfully clicked consent button.${colors.reset}`);
            return true;
        }
    } catch (e) {
        logger.error(`  -> AI consent analysis failed: ${e.message}`);
    }
    
    logger.info(`${colors.grey}  -> No consent button identified.${colors.reset}`);
    return false;
}

async function getPageHtmlWithPlaywright(url, outletName, country) {
    logger.info(`> Deploying browser agent to: ${colors.cyan}${url}${colors.reset}`);
    const browser = await playwright.chromium.launch({ headless: !NO_HEADLESS_FLAG });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
    const page = await context.newPage();
    let consentButtonClicked = false;
    
    try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (response && !response.ok() && response.status() === 404) {
            return { html: null, status: 404, consentButtonClicked: false };
        }
        
        consentButtonClicked = await findAndClickConsentButton(page, country);
        if (consentButtonClicked) await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        const html = await page.content();
        await saveDebugHtml(`${outletName.replace(/[^a-z0-9]/gi, '_')}.html`, html);
        return { html, status: response?.status() || 200, consentButtonClicked };
    } catch (error) {
        logger.error(`  -> Browser agent failed: ${error.message.split('\n')[0]}`);
        return { html: null, status: null, consentButtonClicked };
    } finally {
        await browser.close();
    }
}

// --- Intelligent HTML Analysis Functions ---
function analyzeHtmlStructure(html) {
    logger.info(`> Performing intelligent HTML structure analysis...`);
    const $ = cheerio.load(html);
    
    // First, let's see what we're working with
    const totalLinks = $('a[href]').length;
    const totalElements = $('*').length;
    logger.info(`  -> HTML contains ${totalElements} total elements, ${totalLinks} links with href`);
    
    // Remove noise elements that aren't content
    const beforeCleanup = $('*').length;
    $('nav, footer, header .search, .cookie-banner, .advertisement, .ads, script, style, noscript').remove();
    const afterCleanup = $('*').length;
    logger.info(`  -> Cleaned HTML: removed ${beforeCleanup - afterCleanup} elements, ${afterCleanup} remain`);
    
    const cleanedLinks = $('a[href]').length;
    logger.info(`  -> After cleanup: ${cleanedLinks} links remaining`);
    
    const linkAnalysis = [];
    let processedLinks = 0;
    let skippedLinks = 0;
    
    $('a[href]').each((index, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        
        // Log first few links for debugging
        if (index < 10) {
            logger.info(`${colors.grey}    Link ${index + 1}: href="${href}", text="${$el.text().trim().substring(0, 50)}..."${colors.reset}`);
        }
        
        // Skip non-content links
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
            skippedLinks++;
            if (index < 5) logger.info(`${colors.grey}      -> Skipped: invalid href${colors.reset}`);
            return;
        }
        
        processedLinks++;
        
        // Get all text content and structural information
        const allText = $el.text().trim().replace(/\s+/g, ' ');
        const directText = $el.clone().children().remove().end().text().trim().replace(/\s+/g, ' ');
        
        // Debug text extraction for first few links
        if (index < 5) {
            logger.info(`${colors.grey}      -> All text: "${allText.substring(0, 100)}..."${colors.reset}`);
            logger.info(`${colors.grey}      -> Direct text: "${directText.substring(0, 100)}..."${colors.reset}`);
        }
        
        // Analyze nested structure
        const hasImage = $el.find('img, picture').length > 0;
        const hasVideo = $el.find('video').length > 0;
        const headingElements = $el.find('h1, h2, h3, h4, h5, h6');
        const strongElements = $el.find('strong, b, .title, .headline');
        
        if (index < 5) {
            logger.info(`${colors.grey}      -> Structure: img=${hasImage}, video=${hasVideo}, headings=${headingElements.length}, strong=${strongElements.length}${colors.reset}`);
        }
        
        // Get the most prominent text (usually the headline)
        let prominentText = '';
        if (headingElements.length > 0) {
            prominentText = headingElements.first().text().trim().replace(/\s+/g, ' ');
            if (index < 5) logger.info(`${colors.grey}      -> Using heading text: "${prominentText.substring(0, 50)}..."${colors.reset}`);
        } else if (strongElements.length > 0) {
            prominentText = strongElements.first().text().trim().replace(/\s+/g, ' ');
            if (index < 5) logger.info(`${colors.grey}      -> Using strong text: "${prominentText.substring(0, 50)}..."${colors.reset}`);
        } else {
            // Look for the largest text block
            const textElements = $el.find('*').filter(function() {
                const text = $(this).clone().children().remove().end().text().trim();
                return text.length > 20;
            });
            if (textElements.length > 0) {
                prominentText = textElements.first().text().trim().replace(/\s+/g, ' ');
                if (index < 5) logger.info(`${colors.grey}      -> Using largest text block: "${prominentText.substring(0, 50)}..."${colors.reset}`);
            } else {
                prominentText = allText;
                if (index < 5) logger.info(`${colors.grey}      -> Using all text: "${prominentText.substring(0, 50)}..."${colors.reset}`);
            }
        }
        
        // Clean up common prefixes
        const originalText = prominentText;
        prominentText = prominentText.replace(/^(premium artikel:|artikel:|nieuws:|breaking:|live:|video:|foto:|premium:)/i, '').trim();
        if (originalText !== prominentText && index < 5) {
            logger.info(`${colors.grey}      -> Text after cleanup: "${prominentText.substring(0, 50)}..."${colors.reset}`);
        }
        
        // Analyze context and positioning
        const parentClasses = $el.parent().attr('class') || '';
        const parentTag = $el.parent().prop('tagName')?.toLowerCase() || '';
        const elementClasses = $el.attr('class') || '';
        const elementId = $el.attr('id') || '';
        
        if (index < 5) {
            logger.info(`${colors.grey}      -> Context: parent=${parentTag}.${parentClasses}, element=${elementClasses}${colors.reset}`);
        }
        
        // Check if it's in a content area vs navigation
        const isInNav = $el.closest('nav, .navigation, .menu, .sidebar, footer, header .user-actions').length > 0;
        const isInMain = $el.closest('main, .main, .content, .articles, .news').length > 0;
        
        if (index < 5) {
            logger.info(`${colors.grey}      -> Location: inNav=${isInNav}, inMain=${isInMain}${colors.reset}`);
        }
        
        // Calculate positioning metrics
        const position = index;
        const depth = $el.parents().length;
        
        // Analyze siblings to detect listing patterns
        const siblings = $el.parent().children('a').length;
        const siblingIndex = $el.parent().children('a').index($el);
        
        if (index < 5) {
            logger.info(`${colors.grey}      -> Metrics: position=${position}, depth=${depth}, siblings=${siblings}, siblingIndex=${siblingIndex}${colors.reset}`);
        }
        
        // Apply filtering criteria with detailed logging
        const textLengthOk = prominentText.length >= 15 && prominentText.length <= 200;
        const notInNav = !isInNav;
        
        if (index < 10) {
            logger.info(`${colors.grey}      -> Filters: textLength(${prominentText.length})=${textLengthOk}, notInNav=${notInNav}${colors.reset}`);
        }
        
        if (textLengthOk && notInNav) {
            const linkData = {
                text: prominentText,
                href,
                allText,
                directText,
                hasImage,
                hasVideo,
                headingElements: headingElements.length,
                strongElements: strongElements.length,
                parentClasses,
                parentTag,
                elementClasses,
                elementId,
                isInMain,
                position,
                depth,
                siblings,
                siblingIndex,
                textLength: prominentText.length,
                selector: generateOptimalSelector($, $el)
            };
            
            linkAnalysis.push(linkData);
            
            if (index < 5) {
                logger.info(`${colors.green}      -> ✅ ADDED to analysis: "${prominentText.substring(0, 40)}..."${colors.reset}`);
            }
        } else {
            if (index < 10) {
                logger.info(`${colors.grey}      -> ❌ FILTERED OUT${colors.reset}`);
            }
        }
    });
    
    logger.info(`  -> Link processing complete:`);
    logger.info(`     - Total links processed: ${processedLinks}`);
    logger.info(`     - Links skipped (invalid href): ${skippedLinks}`);
    logger.info(`     - Links passing filters: ${linkAnalysis.length}`);
    
    if (linkAnalysis.length > 0) {
        logger.info(`  -> Sample of filtered links:`);
        linkAnalysis.slice(0, 5).forEach((link, i) => {
            logger.info(`     ${i + 1}. "${link.text.substring(0, 60)}..." (${link.href.substring(0, 50)}...)`);
        });
    } else {
        logger.warn(`${colors.yellow}  -> No links passed the filtering criteria!${colors.reset}`);
        logger.info(`  -> Debugging: Let's check what links exist without filters...`);
        
        let debugCount = 0;
        $('a[href]').each((index, element) => {
            if (debugCount >= 10) return;
            const $el = $(element);
            const href = $el.attr('href');
            const text = $el.text().trim().replace(/\s+/g, ' ');
            
            if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
                logger.info(`       Debug Link ${debugCount + 1}: "${text.substring(0, 50)}..." -> ${href.substring(0, 50)}...`);
                logger.info(`         - Text length: ${text.length}`);
                logger.info(`         - In nav: ${$el.closest('nav, .navigation, .menu, .sidebar, footer, header .user-actions').length > 0}`);
                debugCount++;
            }
        });
    }
    
    logger.info(`  -> Analysis complete: ${linkAnalysis.length} potential headline links identified`);
    return linkAnalysis;
}

function generateOptimalSelector($, element) {
    const $el = $(element);
    const classes = $el.attr('class');
    const id = $el.attr('id');
    const tag = $el.prop('tagName')?.toLowerCase();
    
    // Priority: ID > specific class > data attributes > tag + class
    if (id) return `#${id}`;
    
    if (classes) {
        const classList = classes.split(' ');
        // Look for semantic class names
        const semanticClasses = classList.filter(cls => 
            cls.includes('headline') || cls.includes('title') || cls.includes('link') || 
            cls.includes('teaser') || cls.includes('story') || cls.includes('article')
        );
        if (semanticClasses.length > 0) {
            return `.${semanticClasses[0]}`;
        }
    }
    
    // Check for data attributes
    const dataAttrs = Object.keys($el[0].attribs || {}).filter(attr => attr.startsWith('data-'));
    if (dataAttrs.length > 0) {
        const semanticData = dataAttrs.find(attr => 
            attr.includes('category') || attr.includes('type') || attr.includes('content')
        );
        if (semanticData) {
            return `${tag}[${semanticData}="${$el.attr(semanticData)}"]`;
        }
    }
    
    // Fallback to tag + first class
    if (classes) {
        const firstClass = classes.split(' ')[0];
        return `${tag}.${firstClass}`;
    }
    
    return tag;
}

async function identifyHeadlinesWithAI(linkAnalysis, baseUrl, country) {
    logger.info(`> AI Task: Analyzing ${linkAnalysis.length} links to identify headlines...`);
    
    if (linkAnalysis.length === 0) return { headlines: [], method: 'No links found', selector: null };
    
    // Prepare data for AI analysis - include key metrics but limit size
    const analysisData = linkAnalysis.slice(0, 100).map(link => ({
        text: link.text,
        href: link.href,
        hasImage: link.hasImage,
        hasVideo: link.hasVideo,
        headingElements: link.headingElements,
        strongElements: link.strongElements,
        isInMain: link.isInMain,
        siblings: link.siblings,
        textLength: link.textLength,
        position: link.position,
        elementClasses: link.elementClasses,
        parentClasses: link.parentClasses,
        selector: link.selector
    }));
    
    const sysPrompt = `You are an expert web scraping analyst. Analyze this JSON array of links from a news website in ${country}. Your task is to identify which links are most likely to be NEWS HEADLINES (not navigation, ads, or utility links).

Consider these factors:
- Headlines are usually 20-150 characters long
- They often have images associated with them
- They're typically in main content areas
- They often appear in groups (siblings)
- They may use semantic HTML (headings, strong text)
- Class names might indicate content type
- Position matters (earlier links often more important)

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
  "pattern_analysis": "Description of the common pattern you identified",
  "recommended_selector": "CSS selector that would capture these headlines"
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
            // Convert to expected format and sanitize URLs
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
                    confidence: analysis.headline_links.map(h => h.confidence).reduce((a, b) => a + b, 0) / analysis.headline_links.length
                }
            };
        }
    } catch (e) {
        logger.error(`  -> AI analysis failed: ${e.message}`);
    }
    
    return null;
}

// --- JSON-LD Analysis (Golden Path) ---
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

// --- Main Analysis Pipeline ---
async function getHeadlineData(html, baseUrl, country) {
    logger.info(`> Stage 2: Intelligent headline detection...`);
    
    // Try golden path first
    const jsonLdResult = await tryJsonLdExtraction(html, baseUrl);
    if (jsonLdResult) return jsonLdResult;
    
    logger.info(`${colors.yellow}  -> Golden path failed. Analyzing HTML structure...${colors.reset}`);
    
    // Intelligent structure analysis
    const linkAnalysis = analyzeHtmlStructure(html);
    
    if (linkAnalysis.length === 0) {
        logger.error(`  -> No analyzable links found in HTML`);
        return null;
    }
    
    // AI-powered headline identification
    const aiResult = await identifyHeadlinesWithAI(linkAnalysis, baseUrl, country);
    
    if (aiResult && aiResult.headlines.length >= MIN_HEADLINES_THRESHOLD) {
        logger.info(`${colors.green}  -> AI analysis SUCCESS!${colors.reset}`);
        return aiResult;
    } else if (aiResult && aiResult.headlines.length > 0) {
        logger.warn(`${colors.yellow}  -> AI found ${aiResult.headlines.length} headlines (below threshold of ${MIN_HEADLINES_THRESHOLD})${colors.reset}`);
        // Still return it - might be a smaller page
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
    
    // Intelligent content analysis
    logger.info(`  -> Performing intelligent content analysis...`);
    
    const contentAnalysis = [];
    
    // Analyze different potential content containers
    const potentialSelectors = [
        'article p', 'main p', '.content p', '.article-body p', '.post-content p',
        'div[class*="content"] p', 'div[class*="body"] p', 'div[class*="text"] p',
        '.story-body p', '.article-text p', 'meta[name="description"]'
    ];
    
    // Add learned selectors
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
        } catch (e) {
            // Skip invalid selectors
        }
    }
    
    // Sort by length and find the best content
    contentAnalysis.sort((a, b) => b.length - a.length);
    
    if (contentAnalysis.length > 0 && contentAnalysis[0].length >= MIN_ARTICLE_LENGTH_THRESHOLD) {
        logger.info(`${colors.green}  -> Found article content (${contentAnalysis[0].length} chars)${colors.reset}`);
        return {
            selector: contentAnalysis[0].selector,
            text: contentAnalysis[0].text,
            method: 'Intelligent Content Analysis'
        };
    }
    
    // Fallback: full page text extraction
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

async function findBusinessUrlWithAI(html, baseUrl, country) {
    logger.info(`> AI Task: Finding business/news section URL...`);
    const $ = cheerio.load(html);
    const links = [];
    
    $('nav a, header a').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (text && href) {
            try {
                links.push({ text, url: new URL(href, baseUrl).href });
            } catch(e) {}
        }
    });
    
    if (links.length === 0) {
        logger.warn(`  -> No navigation links found`);
        return null;
    }
    
    logger.info(`  -> Analyzing ${links.length} navigation links`);
    
    const sysPrompt = `You are a multilingual media analyst. From this JSON of navigation links from a news website in ${country}, identify the single URL that most likely leads to the main "News", "Latest News", "Business", or "Economy" section. Respond ONLY with a valid JSON object: { "best_url": "the-full-url", "reasoning": "Your brief reasoning." }`;
    
    try {
        const res = await client.chat.completions.create({
            model: LLM_MODEL,
            messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: JSON.stringify(links) }
            ],
            response_format: { type: 'json_object' }
        });
        
        const { best_url, reasoning } = JSON.parse(res.choices[0].message.content);
        logger.info(`${colors.green}  -> AI identified: ${best_url}${colors.reset}`);
        logger.info(`${colors.grey}     Reasoning: ${reasoning}${colors.reset}`);
        return best_url;
    } catch (e) {
        logger.error(`  -> AI navigation analysis failed: ${e.message}`);
        return null;
    }
}

// --- Main Outlet Analysis ---
async function analyzeOutlet(outlet, learnedSelectors) {
    console.log(`\n\n======================================================================`);
    console.log(`${colors.yellow}🔍 ANALYZING: ${outlet.name} (${outlet.country})${colors.reset}`);
    console.log(`======================================================================`);
    
    logger.info(`> Stage 1: Locating content page...`);
    let finalUrl = outlet.url;
    let urlDiscoveryMethod = 'initial';
    let { html, status, consentButtonClicked } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country);

    if (status === 404) {
        logger.warn(`  -> Initial URL returned 404. Attempting root domain analysis...`);
        urlDiscoveryMethod = 'AI-discovered';
        const rootUrl = new URL(finalUrl).origin;
        const rootResult = await getPageHtmlWithPlaywright(rootUrl, `${outlet.name}_root`, outlet.country);
        
        if (rootResult.html) {
            const correctedUrl = await findBusinessUrlWithAI(rootResult.html, rootUrl, outlet.country);
            if (correctedUrl) {
                finalUrl = correctedUrl;
                ({ html, consentButtonClicked } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country));
            } else {
                html = null;
            }
        } else {
            html = null;
        }
    }

    if (!html) {
        console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not retrieve valid page content${colors.reset}`);
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

    const articleData = await getArticleData(firstArticleUrl, outlet.name, outlet.country, learnedSelectors.articles);

    const analysisResult = {
        urlDiscoveryMethod,
        finalUrl,
        technology: 'playwright + AI',
        headlineSelectorMethod: headlineData.method,
        headlineSelector: headlineData.selector,
        headlinesFound: headlineData.headlines.length,
        articleContentSelector: articleData ? articleData.selector : null,
        sampleArticleLength: articleData ? articleData.text.length : 0,
        aiInsights: headlineData.aiAnalysis || null,
        notes: consentButtonClicked ? 'Consent button clicked by agent.' : 'No interaction required.'
    };

    console.log(`\n--- ✅ CONFIGURATION DISCOVERED FOR: ${outlet.name} ---`);
    console.log(JSON.stringify(analysisResult, null, 2));
    console.log(`-----------------------------------------------------------\n`);

    return analysisResult;
}

// --- Main Execution Logic ---
async function main() {
    logger.info(`🚀 Starting Intelligent Source Configuration Agent (v10.0)...`);
    
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
        logger.info('✅ All outlets analyzed. No new outlets to process.');
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

        await pause();
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

    if (args[0]) allOutlets = allOutlets.filter(o => o.country.toLowerCase().includes(args[0].toLowerCase()));
    if (args[1]) allOutlets = allOutlets.filter(o => o.name.toLowerCase().includes(args[1].toLowerCase()));

    const unprocessedOutlets = allOutlets.filter(o => 
        !o.labCheckPerformed || 
        !o.analysis?.articleContentSelector || 
        o.analysis?.sampleArticleLength < MIN_ARTICLE_LENGTH_THRESHOLD
    );

    if (unprocessedOutlets.length === 0 && allOutlets.length > 0) {
        logger.info(`Found ${allOutlets.length} matching outlet(s), but all analyzed. To re-run, set "labCheckPerformed" to false.`);
        return [];
    }

    logger.info(`Found ${unprocessedOutlets.length} unprocessed outlet(s) to analyze.`);
    return unprocessedOutlets;
}

main().catch(e => { 
    logger.fatal('Critical error occurred:', e); 
    rl.close(); 
    process.exit(1); 
});