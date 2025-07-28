// src/modules/scraper/index.js (version 1.3)
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../../utils/logger.js';
import { safeExecute } from '../../utils/helpers.js';
import { CONCURRENCY_LIMIT, SCRAPER_PROXY_URL } from '../../config/index.js';
import { SITES_CONFIG, TEXT_SELECTORS } from '../../config/sources.js';

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

async function fetchPage(url) {
    // Add a generous 30-second timeout to handle slow-responding sites.
    const axiosConfig = { headers: BROWSER_HEADERS, timeout: 30000 };
    const result = await safeExecute(() => axiosInstance.get(url, axiosConfig), {
        errorHandler: (err) => {
            const status = err.response ? err.response.status : 'N/A';
            // Add specific logging for timeout errors for better debugging.
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                logger.error(`Request to ${url} timed out after 30 seconds.`);
            } else {
                logger.error(`Failed to fetch page ${url} [Status: ${status}].`);
            }
            return null;
        }
    });
    // Return the response object which contains data
    return result;
}

async function scrapeSite(site) {
    logger.debug(`Scraping headlines from ${site.name}`);
    const response = await fetchPage(site.url);
    if (!response) return [];
    
    const $ = cheerio.load(response.data);
    let articles = [];

    if (site.useJsonLd) {
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const jsonData = JSON.parse($(el).html());
                if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement) {
                    jsonData.itemListElement.forEach(item => {
                        if (item.name && item.url) articles.push({ headline: item.name, link: item.url, source: site.name, newspaper: site.name });
                    });
                }
            } catch (e) { 
                logger.warn({ err: e, site: site.name }, `Failed to parse JSON-LD from ${site.name}`);
            }
        });
    } else {
        $(site.selector).each((_, el) => {
            const articleData = site.extract($(el), site);
            if (articleData && articleData.headline && articleData.link) {
                articles.push(articleData);
            }
        });
    }
    
    const uniqueArticles = Array.from(new Map(articles.map(a => [a.link, a])).values());
    logger.info(`Scraped ${uniqueArticles.length} unique headlines from ${site.name}.`);
    return uniqueArticles;
}

export async function scrapeAllHeadlines() {
    logger.info('📰 Starting headline scraping from all sources...');
    const promises = Object.values(SITES_CONFIG).map(site => limit(() => scrapeSite(site)));
    const results = await Promise.all(promises);
    return results.flat();
}

export async function scrapeArticleContent(article) {
    logger.debug(`Enriching article: ${article.link}`);
    const newspaperName = article.newspaper || article.source;
    const selector = TEXT_SELECTORS[newspaperName];
    if (!selector) {
        logger.warn(`No text selector for newspaper "${newspaperName}".`);
        return { ...article, enrichment_error: 'No selector' };
    }
    const pageResponse = await fetchPage(article.link);
    if (!pageResponse) {
        return { ...article, enrichment_error: 'Failed to fetch page' };
    }
    const $ = cheerio.load(pageResponse.data);
    const fullText = $(selector).map((_, el) => $(el).text()).get().join(' ').replace(/\s\s+/g, ' ').trim();
    if (fullText) {
        article.articleContent = { contents: [fullText] };
    } else {
        logger.warn(`Could not find text for "${article.headline}" with selector "${selector}"`);
        article.enrichment_error = 'Content not found';
    }
    return article;
}