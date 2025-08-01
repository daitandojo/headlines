// src/modules/scraper/index.js
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
    const axiosConfig = { headers: BROWSER_HEADERS, timeout: 30000 };
    const result = await safeExecute(() => axiosInstance.get(url, axiosConfig), {
        errorHandler: (err) => {
            const status = err.response ? err.response.status : 'N/A';
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                logger.error(`Request to ${url} timed out after 30 seconds.`);
            } else {
                logger.error(`Failed to fetch page ${url} [Status: ${status}].`);
            }
            return null;
        }
    });
    return result;
}

async function scrapeSite(site) {
    logger.debug(`Scraping headlines from ${site.name}`);
    
    // --- SPECIAL API-BASED SCRAPING FOR EQT ---
    if (site.name === 'EQT') {
        const pageResponse = await fetchPage(site.url);
        if (!pageResponse) return { source: site.name, articles: [], success: false };

        const buildIdMatch = pageResponse.data.match(/"buildId":"([a-zA-Z0-9_-]+)"/);
        if (!buildIdMatch || !buildIdMatch[1]) {
            logger.warn(`Could not find Build ID for EQT. Site structure may have changed.`);
            return { source: site.name, articles: [], success: false };
        }
        const buildId = buildIdMatch[1];
        const apiUrl = `${site.url.replace('/news', '')}/_next/data/${buildId}/en/news.json`;

        const apiResponse = await fetchPage(apiUrl);
        if (!apiResponse) return { source: site.name, articles: [], success: false };
        
        try {
            const hits = apiResponse.data?.pageProps?.page?.pageContent?.find(c => c._type === 'listing')?.initialResults?.main?.hits || [];
            const articles = hits.map(hit => ({
                headline: hit.thumbnail.title,
                link: new URL(hit.thumbnail.path, site.url).href,
                source: site.name,
                newspaper: site.newspaper,
            }));
            logger.info(`Scraped ${articles.length} unique headlines from ${site.name}.`);
            return { source: site.name, articles, success: true };
        } catch (e) {
            logger.error({ err: e }, `Failed to parse API response from EQT.`);
            return { source: site.name, articles: [], success: false };
        }
    }

    // --- STANDARD HTML SCRAPING FOR ALL OTHER SITES ---
    const response = await fetchPage(site.url);
    if (!response) {
        return { source: site.name, articles: [], success: false };
    }
    
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
    return { source: site.name, articles: uniqueArticles, success: true };
}

export async function scrapeAllHeadlines() {
    logger.info('📰 Starting headline scraping from all sources...');
    const promises = Object.values(SITES_CONFIG).map(site => limit(() => scrapeSite(site)));
    const results = await Promise.all(promises);

    const allArticles = results.flatMap(r => r.articles);
    const scraperHealth = results.map(r => ({ source: r.source, success: r.success, count: r.articles.length }));

    return { allArticles, scraperHealth };
}

export async function scrapeArticleContent(article) {
    logger.debug(`Enriching article: ${article.link}`);
    
    const pageResponse = await fetchPage(article.link);
    if (!pageResponse) {
        return { ...article, enrichment_error: 'Failed to fetch page' };
    }
    
    // --- SPECIAL JSON-BASED ENRICHMENT FOR EQT ARTICLES ---
    if (article.newspaper === 'EQT') {
        const $page = cheerio.load(pageResponse.data);
        const scriptData = $page('script#__NEXT_DATA__').html();
        if (scriptData) {
            try {
                const jsonData = JSON.parse(scriptData);
                // Navigate through the complex JSON structure to find the article body
                const pageContent = jsonData?.props?.pageProps?.page?.pageContent;
                if (pageContent) {
                    const richTextBlock = pageContent.find(block => block._type === 'richTextBlock');
                    if (richTextBlock && richTextBlock.body) {
                        const bodyHtml = richTextBlock.body;
                        const $body = cheerio.load(bodyHtml);
                        const fullText = $body.text().replace(/\s\s+/g, ' ').trim();
                        article.articleContent = { contents: [fullText] };
                        return article;
                    }
                }
            } catch (e) {
                logger.warn({ err: e }, `Failed to parse JSON data for EQT article: ${article.link}. Falling back to standard method.`);
            }
        }
    }

    // --- STANDARD METHOD FOR ALL OTHER SITES (AND EQT FALLBACK) ---
    const newspaperName = article.newspaper || article.source;
    const selector = TEXT_SELECTORS[newspaperName];
    if (!selector) {
        logger.warn(`No text selector for newspaper "${newspaperName}".`);
        return { ...article, enrichment_error: 'No selector' };
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