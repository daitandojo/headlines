// scripts/find-selectors.js (version 9.2)
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
const SAVE_HTML_FLAG = process.argv.includes('--save-html');
const NO_HEADLESS_FLAG = process.argv.includes('--no-headless');

const BASE_HEADLINE_SELECTORS = ['article a h2','article a h3','article a h4','a h2','a h3','a h4','h2 a','h3 a','h4 a','div[class*="headline"] a','div[class*="title"] a','div[class*="teaser"] a','a[class*="headline"]','a[class*="title"]','a[class*="teaser"]', '.thumblist__title', '.listheadline__link'];
const BASE_ARTICLE_SELECTORS = ['article[class*="body"] p','div[class*="content"] p','div[class*="article-body"] p','div.prose p','div[role="article"] p', 'main[id*="content"] p', 'main p', 'meta[name="description"]'];

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
    try {
        // Absolute URLs are easy
        if (url.startsWith('http')) {
            return new URL(url).href;
        }
        // Relative URLs
        return new URL(url, baseUrl).href;
    } catch (e) {
        // Malformed URL recovery logic
        const lastHttp = url.lastIndexOf('http');
        if (lastHttp > 0) {
            const potentialUrl = url.substring(lastHttp);
            try {
                return new URL(potentialUrl).href;
            } catch (e2) {
                 logger.error(`  -> Sanitization failed even after recovery attempt for: ${url}`);
                return null;
            }
        }
        logger.error(`  -> Sanitization failed for: ${url}`);
        return null;
    }
}


// --- Agentic Browser & AI Functions ---
async function findAndClickConsentButton(page, country) {
    logger.info(`> AI Task: Identifying consent button...`);
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[role="button"]')).map(el => el.innerText.trim()).filter(text => text.length > 2 && text.length < 30));
    if (buttons.length === 0) {
        logger.info(`${colors.grey}  -> No buttons found to analyze for consent.${colors.reset}`);
        return false;
    }
    const sysPrompt = `You are a web automation expert. From this JSON array of button texts from a website in ${country}, identify the SINGLE button text that accepts cookies, privacy, or consent. Prioritize clear "accept" actions (like 'Accept', 'Agree', 'OK') over ambiguous "settings" links. Respond ONLY with a valid JSON object: { "text_to_click": "The exact text of the button to click" } OR { "text_to_click": null }`;
    try {
        const res = await client.chat.completions.create({ model: LLM_MODEL, messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: JSON.stringify(buttons) }], response_format: { type: 'json_object' } });
        const { text_to_click } = JSON.parse(res.choices[0].message.content);
        if (text_to_click) {
            logger.info(`  -> AI advised clicking button with text: "${text_to_click}". Attempting click...`);
            await page.getByRole('button', { name: text_to_click, exact: true }).first().click({ timeout: 5000 });
            logger.info(`${colors.green}  -> Agent successfully clicked consent button.${colors.reset}`);
            return true;
        }
    } catch (e) {
        logger.error(`  -> AI consent button analysis failed: ${e.message}`);
    }
    logger.info(`${colors.grey}  -> AI did not identify a consent button to click.${colors.reset}`);
    return false;
}

async function getPageHtmlWithPlaywright(url, outletName, country) {
    logger.info(`> Deploying agent (Playwright) to: ${colors.cyan}${url}${colors.reset}`);
    const browser = await playwright.chromium.launch({ headless: !NO_HEADLESS_FLAG });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
    const page = await context.newPage();
    let consentButtonClicked = false;
    try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (response && !response.ok()) {
            if (response.status() === 404) return { html: null, status: 404, consentButtonClicked: false };
        }
        consentButtonClicked = await findAndClickConsentButton(page, country);
        if (consentButtonClicked) await page.waitForLoadState('networkidle', { timeout: 10000 });
        const html = await page.content();
        await saveDebugHtml(`${outletName.replace(/[^a-z0-9]/gi, '_')}.html`, html);
        return { html, status: response?.status() || 200, consentButtonClicked };
    } catch (error) {
        logger.error(`  -> Agent failed during navigation: ${error.message.split('\n')[0]}`);
        return { html: null, status: null, consentButtonClicked };
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

// --- Core Analysis Pipeline ---
function extractFromHtml($, selector, baseUrl, type) {
    if (type === 'article' && selector === 'body.cleaned') {
        $('nav, header, footer, aside, .comments, .sidebar, script, style').remove();
        return $('body').text().replace(/\s+/g, ' ').trim();
    }
    if (type === 'article' && selector.startsWith('meta')) return $(selector).attr('content') || '';
    const results = [];
    $(selector).each((_, el) => {
        const element = $(el);
        if (type === 'headline') {
            const headline = element.text().trim().replace(/\s+/g, ' ');
            const href = element.attr('href');
            if (headline && href) {
                const finalUrl = sanitizeUrl(href, baseUrl);
                if(finalUrl) results.push({ headline, link: finalUrl });
            }
        } else { results.push(element.text().trim()); }
    });
    return type === 'headline' ? Array.from(new Map(results.map(i => [i.link, i])).values()) : results.join(' ').replace(/\s+/g, ' ');
}

async function getHeadlineData(html, baseUrl, learnedSelectors) {
    logger.info(`> Stage 2: Finding headline selector...`);
    const $ = cheerio.load(html);
    logger.info(`  -> Trying golden path (JSON-LD structured data)...`);
    let ldJsonHeadlines = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const jsonString = $(el).html();
            if (!jsonString) return;
            const data = JSON.parse(jsonString);
            const items = data.itemListElement || (data['@graph'] && data['@graph'].find(item => item.itemListElement)?.itemListElement) || (Array.isArray(data) && data.find(i => i.itemListElement)?.itemListElement);
            if (items && Array.isArray(items)) {
                items.forEach(item => {
                    const headline = item.name || item.item?.name;
                    const url = item.url || item.item?.url;
                    if (headline && url) {
                        const finalUrl = sanitizeUrl(url, baseUrl);
                        if(finalUrl) ldJsonHeadlines.push({ headline: headline.replace(/\s+/g, ' ').trim(), link: finalUrl });
                        else logger.warn(`${colors.yellow}  -> Found headline "${headline}" in JSON-LD but failed to sanitize its URL: "${url}"${colors.reset}`);
                    }
                });
            }
        } catch(e){ logger.warn(`${colors.yellow}  -> Warning: Failed to parse a JSON-LD block. ${e.message}${colors.reset}`); }
    });
    if (ldJsonHeadlines.length >= MIN_HEADLINES_THRESHOLD) {
        logger.info(`${colors.green}  -> Golden path SUCCESS. Found ${ldJsonHeadlines.length} headlines in JSON-LD.${colors.reset}`);
        logger.info(`${colors.grey}     First entry: { headline: "${ldJsonHeadlines[0].headline}", link: "${ldJsonHeadlines[0].link}" }${colors.reset}`);
        return { headlines: ldJsonHeadlines, method: 'JSON-LD', selector: 'script[type="application/ld+json"]' };
    }
    logger.info(`${colors.yellow}  -> Golden path failed. Falling back to CSS selector analysis.${colors.reset}`);
    const selectorsToTry = [...new Set([...learnedSelectors, ...BASE_HEADLINE_SELECTORS])];
    logger.info(`  -> Trying ${selectorsToTry.length} selectors (${learnedSelectors.length} learned)...`);
    let bestResult = { selector: null, headlines: [] };
    for (const selector of selectorsToTry) {
        const headlines = extractFromHtml($, selector, baseUrl, 'headline');
        if (headlines.length > bestResult.headlines.length) bestResult = { selector, headlines };
    }
    if (bestResult.headlines.length >= MIN_HEADLINES_THRESHOLD) {
        logger.info(`${colors.green}  -> Heuristic selector search SUCCESS.${colors.reset}`);
        return { ...bestResult, method: `CSS Selector (${learnedSelectors.includes(bestResult.selector) ? 'Learned' : 'Heuristic'})` };
    }
    return null;
}

async function getArticleData(url, outletName, country, learnedSelectors) {
    logger.info(`> Stage 3: Analyzing first article for content selector...`);
    const { html } = await getPageHtmlWithPlaywright(url, `${outletName}_article`, country);
    if (!html) return null;
    const $ = cheerio.load(html);
    const selectorsToTry = [...new Set([...learnedSelectors, ...BASE_ARTICLE_SELECTORS])];
    logger.info(`  -> Trying ${selectorsToTry.length} selectors (${learnedSelectors.length} learned)...`);
    let bestResult = { selector: null, text: '' };
    for (const selector of selectorsToTry) {
        const text = extractFromHtml($, selector, url, 'article');
        if (text.length > bestResult.text.length) bestResult = { selector, text };
    }
    if (bestResult.text.length >= MIN_ARTICLE_LENGTH_THRESHOLD) {
        logger.info(`${colors.green}  -> Heuristic selector search SUCCESS.${colors.reset}`);
        return { ...bestResult, method: `CSS Selector (${learnedSelectors.includes(bestResult.selector) ? 'Learned' : 'Heuristic'})` };
    }
    logger.warn(`  -> Heuristic search insufficient (${bestResult.text.length} chars). Escalating to AI for full-page text extraction.`);
    const bodyText = extractFromHtml($, 'body.cleaned', url, 'article');
    if(bodyText.length >= MIN_ARTICLE_LENGTH_THRESHOLD) {
        return { selector: 'body.cleaned', text: bodyText, method: 'Full-Page Text Dump' };
    }
    return null;
}

async function analyzeOutlet(outlet, learnedSelectors, forceArticleRecheck = false) {
    console.log(`\n\n======================================================================`);
    console.log(`${colors.yellow}Analyzing: ${outlet.name} (${outlet.country})${colors.reset}`);
    console.log(`======================================================================`);
    let analysisResult = { ...outlet.analysis };
    let consentButtonClicked = false;
    if (!forceArticleRecheck) {
        logger.info(`> Stage 1: Locating business section page...`);
        let finalUrl = outlet.url;
        let urlDiscoveryMethod = 'initial';
        let { html, status, consentButtonClicked: cbClicked } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country);
        consentButtonClicked = cbClicked;
        if (status === 404) {
            logger.warn(`  -> Initial URL gave 404. Agent will attempt to find correct section from root domain...`);
            urlDiscoveryMethod = 'AI-discovered';
            const rootUrl = new URL(finalUrl).origin;
            const rootResult = await getPageHtmlWithPlaywright(rootUrl, `${outlet.name}_root`, outlet.country);
            if (rootResult.html) {
                const correctedUrl = await findBusinessUrlWithAI(rootResult.html, rootUrl, outlet.country);
                if (correctedUrl) {
                    finalUrl = correctedUrl;
                    ({ html, consentButtonClicked } = await getPageHtmlWithPlaywright(finalUrl, outlet.name, outlet.country));
                } else { html = null; }
            } else { html = null; }
        }
        if (!html) { console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not retrieve a valid page for analysis.${colors.reset}`); return null; }
        const headlineData = await getHeadlineData(html, finalUrl, learnedSelectors.headlines);
        if (!headlineData) { console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not determine a reliable source for headlines.${colors.reset}`); return null; }
        analysisResult = {
            urlDiscoveryMethod,
            finalUrl,
            technology: 'playwright',
            headlineSelectorMethod: headlineData.method,
            headlineSelector: headlineData.selector,
            headlinesFound: headlineData.headlines.length,
            firstArticleUrl: headlineData.headlines[0]?.link
        };
    } else {
        logger.info(`> Re-running Stage 3 (Article Analysis) for previously failed outlet...`);
    }
    if (!analysisResult.firstArticleUrl) {
        console.log(`\n${colors.red}❌ ANALYSIS FAILED: Could not extract a valid URL from the found headlines.${colors.reset}`);
        return null;
    }
    const articleData = await getArticleData(analysisResult.firstArticleUrl, outlet.name, outlet.country, learnedSelectors.articles);
    analysisResult.articleContentSelector = articleData ? articleData.selector : null;
    analysisResult.sampleArticleLength = articleData ? articleData.text.length : 0;
    analysisResult.notes = consentButtonClicked ? 'Consent button clicked by agent.' : 'No special interaction needed.';
    console.log(`\n--- ✅ CONFIGURATION DISCOVERED FOR: ${outlet.name} ---`);
    console.log(JSON.stringify(analysisResult, null, 2));
    console.log(`-----------------------------------------------------------\n`);
    return analysisResult;
}

// --- Main Execution Logic ---
async function main() {
    logger.info(`🚀 Starting Self-Learning Source Configuration Agent (v9.2)...`);
    let allPapersData;
    try {
        const fileContent = await fs.readFile(PAPERS_CONFIG_PATH, 'utf-8');
        allPapersData = JSON.parse(fileContent);
    } catch (e) { logger.fatal(`${colors.red}Could not read or parse ${PAPERS_CONFIG_PATH}: ${e.message}${colors.reset}`); return; }
    
    const learnedSelectors = generateLearnedSelectors(allPapersData);
    const outletsToProcess = getOutletsToProcess(allPapersData);
    if (!outletsToProcess || outletsToProcess.length === 0) {
        logger.info('✅ All outlets have been analyzed. No new outlets to process.');
        rl.close();
        return;
    }
    for (const outlet of outletsToProcess) {
        const forceArticleRecheck = outlet.labCheckPerformed && (!outlet.analysis?.articleContentSelector || outlet.analysis?.sampleArticleLength < MIN_ARTICLE_LENGTH_THRESHOLD);
        const analysisResult = await analyzeOutlet(outlet, learnedSelectors, forceArticleRecheck);
        if (analysisResult) {
            const countryIndex = allPapersData.findIndex(c => `${c.flag_emoji} ${c.country}` === outlet.country);
            const outletIndex = allPapersData[countryIndex].outlets.findIndex(o => o.name === outlet.name);
            allPapersData[countryIndex].outlets[outletIndex] = { ...outlet, ...allPapersData[countryIndex].outlets[outletIndex], labCheckPerformed: true, url: analysisResult.finalUrl, analysis: analysisResult };
            try {
                await fs.writeFile(PAPERS_CONFIG_PATH, JSON.stringify(allPapersData, null, 2));
                logger.info(`${colors.green}Successfully saved configuration for ${outlet.name} to papers.json.${colors.reset}`);
            } catch (error) { logger.fatal(`${colors.red}CRITICAL: Failed to save updated papers.json! Error: ${error.message}${colors.reset}`); }
        } else {
             logger.warn(`${colors.yellow}Analysis for ${outlet.name} was unsuccessful. It will be re-analyzed on the next run.${colors.reset}`);
        }
        await pause();
    }
    logger.info('✅ Analysis finished for all targeted outlets.');
    rl.close();
}

function generateLearnedSelectors(allPapersData) {
    const headlines = new Set();
    const articles = new Set();
    allPapersData.forEach(country => {
        country.outlets.forEach(outlet => {
            if (outlet.labCheckPerformed && outlet.analysis) {
                if (outlet.analysis.headlineSelector && !outlet.analysis.headlineSelector.includes('script')) headlines.add(outlet.analysis.headlineSelector);
                if (outlet.analysis.articleContentSelector) articles.add(outlet.analysis.articleContentSelector);
            }
        });
    });
    const learned = { headlines: Array.from(headlines), articles: Array.from(articles) };
    logger.info(`> Learning Phase: Loaded ${learned.headlines.length} headline and ${learned.articles.length} article selectors from previous successes.`);
    return learned;
}

function getOutletsToProcess(allPapersData) {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    let allOutlets = allPapersData.flatMap(c => c.outlets.map(o => ({...o, country: `${c.flag_emoji} ${c.country}`})));
    if (args[0]) allOutlets = allOutlets.filter(o => o.country.toLowerCase().includes(args[0].toLowerCase()));
    if (args[1]) allOutlets = allOutlets.filter(o => o.name.toLowerCase().includes(args[1].toLowerCase()));
    const unprocessedOutlets = allOutlets.filter(o => !o.labCheckPerformed || !o.analysis?.articleContentSelector || o.analysis?.sampleArticleLength < MIN_ARTICLE_LENGTH_THRESHOLD || !o.analysis?.firstArticleUrl);
    if (unprocessedOutlets.length === 0 && allOutlets.length > 0) {
        logger.info(`Found ${allOutlets.length} matching outlet(s), but all have been successfully analyzed. To re-run, set "labCheckPerformed" to false in papers.json.`);
        return [];
    }
    logger.info(`Found ${unprocessedOutlets.length} unprocessed or incomplete outlet(s) to analyze.`);
    return unprocessedOutlets;
}

main().catch(e => { logger.fatal('A critical error occurred:', e); rl.close(); process.exit(1); });