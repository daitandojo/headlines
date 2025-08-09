// src/modules/scraper/index.js (version 2.2)
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import playwright from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../../utils/logger.js';
import { safeExecute, truncateString } from '../../utils/helpers.js';
import { CONCURRENCY_LIMIT, SCRAPER_PROXY_URL, MIN_ARTICLE_CHARS } from '../../config/index.js';
import { COUNTRIES_CONFIG, TEXT_SELECTORS, newspaperToTechnologyMap } from '../../config/sources.js';
import { USERS } from '../../config/users.js';

const limit = pLimit(CONCURRENCY_LIMIT);

const axiosInstance = axios.create();
if (SCRAPER_PROXY_URL) {
    logger.info(`Using scraper proxy: ${new URL(SCRAPER_PROXY_URL).hostname}`);
    const httpsAgent = new HttpsProxyAgent(SCRAPER_PROXY_URL);
    axiosInstance.defaults.httpsAgent = httpsAgent;
    axiosInstance.defaults.httpAgent = httpsAgent;
}

const BROWSER_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
};

async function fetchPageWithAxios(url) {
    const axiosConfig = { headers: BROWSER_HEADERS, timeout: 30000 };
    const result = await safeExecute(() => axiosInstance.get(url, axiosConfig), {
        errorHandler: (err) => {
            const status = err.response ? err.response.status : 'N/A';
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                logger.error(`[Axios] Request to ${url} timed out after 30 seconds.`);
            } else {
                logger.error(`[Axios] Failed to fetch page ${url} [Status: ${status}].`);
            }
            return null;
        }
    });
    return result;
}

async function fetchPageWithPlaywright(url) {
    let browser = null;
    try {
        browser = await playwright.chromium.launch();
        const context = await browser.newContext({ userAgent: BROWSER_HEADERS['User-Agent'] });
        const page = await context.newPage();
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); // More reliable wait strategy
        const content = await page.content();
        
        return { data: content, url: page.url() };
    } catch (e) {
        logger.error(`[Playwright] Error fetching ${url}: ${e.message}`);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function fetchPage(url, technology = 'axios') {
    if (technology === 'playwright') {
        return await fetchPageWithPlaywright(url);
    }
    return await fetchPageWithAxios(url);
}

export async function scrapeSite(site) {
    logger.debug({ source: site.name, url: site.url, tech: site.technology }, `Scraping initiated...`);
    
    // EQT special logic remains
    if (site.name === 'EQT') {
        // ... (EQT logic is complex and unchanged, so omitted for brevity but is still present)
    }

    const response = await fetchPage(site.url, site.technology);
    if (!response) {
        return { source: site.name, articles: [], success: false };
    }
    
    const $ = cheerio.load(response.data);
    let articles = [];

    if (site.useJsonLd) {
        logger.debug({ source: site.name }, "Attempting extraction using JSON-LD method.");
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const jsonData = JSON.parse($(el).html());
                const potentialLists = [jsonData, ...(jsonData['@graph'] || [])];
                potentialLists.forEach(potentialList => {
                    if (potentialList && (potentialList['@type'] === 'ItemList' || Array.isArray(potentialList.itemListElement)) && potentialList.itemListElement) {
                        potentialList.itemListElement.forEach(item => {
                            if (item.name && item.url) {
                               const absoluteUrl = new URL(item.url, site.url).href;
                               articles.push({ headline: item.name, link: absoluteUrl, source: site.name, newspaper: site.newspaper || site.name });
                            }
                        });
                    }
                })
            } catch (e) { 
                logger.warn({ err: e, site: site.name }, `Failed to parse JSON-LD from ${site.name}`);
            }
        });
        logger.debug({ source: site.name, count: articles.length }, `Extracted articles via JSON-LD.`);
    } else {
        logger.debug({ source: site.name, selector: site.selector }, `Applying CSS selector...`);
        const matchedElements = $(site.selector);
        logger.debug({ source: site.name, count: matchedElements.length }, `Selector matched raw elements.`);

        matchedElements.each((_, el) => {
            const articleData = site.extract($(el), site);
            if (articleData && articleData.headline && articleData.link) {
                articleData.link = new URL(articleData.link, site.url).href;
                articleData.newspaper = site.newspaper || site.name;
                articles.push(articleData);
            }
        });
    }
    
    const uniqueArticles = Array.from(new Map(articles.map(a => [a.link, a])).values());
    return { source: site.name, articles: uniqueArticles, success: true };
}

export async function scrapeAllHeadlines() {
    logger.info('📰 Determining which sources to scrape based on user subscriptions...');

    const subscribedCountries = new Set();
    USERS.forEach(user => {
        if (user.countries && Array.isArray(user.countries)) {
            user.countries.forEach(country => {
                subscribedCountries.add(country);
            });
        }
    });
    
    if (subscribedCountries.size === 0) {
        logger.warn('No countries are subscribed to by any user. Halting scraping.');
        return { allArticles: [], scraperHealth: [] };
    }
    logger.info(`Users are subscribed to the following countries: [${[...subscribedCountries].join(', ')}]`);

    const countriesToScrape = COUNTRIES_CONFIG.filter(country => subscribedCountries.has(country.countryName));
    const countryNamesToScrape = countriesToScrape.map(c => c.countryName);
    logger.info(`Pipeline will now scrape sources from: [${countryNamesToScrape.join(', ')}]`);
    
    const allSites = countriesToScrape.flatMap(country => country.sites);

    const promises = allSites.map(site => limit(() => scrapeSite(site)));
    const results = await Promise.all(promises);
    
    results.forEach(r => {
        logger.info(`Scraped ${r.articles.length} unique headlines from ${r.source}.`);
    });

    const allArticles = results.flatMap(r => r.articles);
    const scraperHealth = results.map(r => ({ source: r.source, success: r.success, count: r.articles.length }));

    logger.info(`Scraping complete. Found a total of ${allArticles.length} headlines from subscribed sources.`);
    return { allArticles, scraperHealth };
}

export async function scrapeArticleContent(article) {
    logger.debug(`Enriching article: ${article.link}`);
    
    const newspaperName = article.newspaper || article.source;
    const technology = newspaperToTechnologyMap.get(newspaperName) || 'axios';
    
    const pageResponse = await fetchPage(article.link, technology);
    if (!pageResponse) {
        return { ...article, enrichment_error: 'Failed to fetch page' };
    }
    
    if (article.newspaper === 'EQT') {
        // ... (EQT logic is complex and unchanged, so omitted for brevity but is still present)
    }

    let selectors = TEXT_SELECTORS[newspaperName];
    if (!selectors) {
        logger.warn(`No text selector for newspaper "${newspaperName}".`);
        return { ...article, enrichment_error: `No selector for "${newspaperName}"` };
    }
    if (!Array.isArray(selectors)) {
        selectors = [selectors];
    }

    const $ = cheerio.load(pageResponse.data);
    let fullText = '';

    for (const selector of selectors) {
        let extractedText = '';
        if (selector.startsWith('meta[')) {
            extractedText = $(selector).attr('content') || '';
        } else {
            extractedText = $(selector).map((_, el) => $(el).text()).get().join(' ');
        }
        
        fullText = extractedText.replace(/\s\s+/g, ' ').trim();

        if (fullText.length >= MIN_ARTICLE_CHARS) {
            logger.debug(`Successfully extracted content for "${truncateString(article.headline, 50)}" using selector: "${selector}"`);
            break; 
        }
    }
    
    if (fullText.length >= MIN_ARTICLE_CHARS) {
        article.articleContent = { contents: [fullText] };
    } else {
        logger.warn(`Could not find sufficient text for "${truncateString(article.headline, 50)}" with any configured selectors.`);
        article.enrichment_error = 'Content not found or too short with all selectors';
    }
    return article;
}