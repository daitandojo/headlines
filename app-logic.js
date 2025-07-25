import mongoose from 'mongoose';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';
import pLimit from 'p-limit';
import { SOURCES, HEADLINES_RELEVANCE_THRESHOLD, ARTICLES_RELEVANCE_THRESHOLD, SMTP_CONFIG, HEADLINE_RECIPIENTS, SUPERVISOR_EMAIL, CONCURRENCY_LIMIT, DEFAULT_USER_AGENT, MIN_ARTICLE_CHARS } from './src/config/index.js';
import Article from './models/Article.js';

// A simple, dependency-free logger
const log = (level, message, data) => {
  const logData = data ? `| data: ${JSON.stringify(data).substring(0, 200)}` : '';
  console.log(`[PIPELINE] [${level.toUpperCase()}] - ${message} ${logData}`);
};

// --- 1. HEADLINE SCRAPING ---
async function fetchHeadlinesFromSource(source) {
    log('info', `Fetching headlines from ${source.name}...`);
    try {
        const { data: html } = await axios.get(source.startUrl, {
            timeout: 30000,
            headers: { 'User-Agent': DEFAULT_USER_AGENT }
        });
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const links = [...document.querySelectorAll(source.linkSelector)];
        const headlines = links.map(link => {
            const href = link.getAttribute('href');
            if (!href) return null;
            return {
                headline: link.textContent.trim(),
                link: new URL(href, source.baseUrl).href,
                newspaper: source.newspaper,
                source: source.name,
                relevance_headline: 0,
                assessment_headline: 'Not assessed',
            };
        }).filter(h => h && h.headline && h.headline.length > 15);
        
        log('info', `Found ${headlines.length} valid headlines from ${source.name}.`);
        return headlines;
    } catch (error) {
        log('error', `Failed to fetch from ${source.name}`, { message: error.message });
        return [];
    }
}

// --- 2. ARTICLE ENRICHMENT ---
async function enrichArticleWithContent(article, sourceConfig) {
    log('info', `Enriching article: "${article.headline.substring(0, 50)}..."`);
    try {
        const { data: html } = await axios.get(article.link, {
            timeout: 30000,
            headers: { 'User-Agent': DEFAULT_USER_AGENT }
        });
        const dom = new JSDOM(html);
        const document = dom.window.document;

        const articleContent = {};
        sourceConfig.articleStructure.forEach(({ elementName, selector }) => {
            const elements = [...document.querySelectorAll(selector)];
            articleContent[elementName] = elements.map(el => el.textContent.trim()).filter(Boolean);
        });

        const totalContent = Object.values(articleContent).flat().join(' ');
        if (totalContent.length < MIN_ARTICLE_CHARS) {
            return { ...article, enrichment_error: `Insufficient content: ${totalContent.length} chars` };
        }
        
        return { ...article, articleContent };
    } catch (error) {
        log('error', `Failed to enrich article: ${article.link}`, { message: error.message });
        return { ...article, enrichment_error: error.message };
    }
}


// --- 3. AI ASSESSMENT (MOCKED) ---
async function assessWithMockAI(items, type) {
    log('info', `(MOCK AI) Assessing ${items.length} ${type}...`);
    if (type === 'headlines') {
        return items.map(item => ({
            ...item,
            relevance_headline: item.headline.toLowerCase().includes('milliard') ? 95 : 5,
            assessment_headline: 'Mock headline assessment: Relevant based on keywords.',
        }));
    } else { // articles
        return items.map(item => ({
            ...item,
            relevance_article: (item.articleContent?.contents?.join(' ') || '').length > 1000 ? 95 : 5,
            assessment_article: 'Mock article assessment: Relevant based on length.',
        }));
    }
}

// --- 4. EMAIL LOGIC ---
async function sendEmail(articles, isSupervisorReport = false, stats = {}) {
    if (!SMTP_CONFIG?.auth?.user) {
        log('warn', 'SMTP not configured. Skipping email.');
        return;
    }
    const recipients = isSupervisorReport ? SUPERVISOR_EMAIL : (HEADLINE_RECIPIENTS || []).join(',');
    if (!recipients) return;
    const subject = isSupervisorReport ? `Pipeline Report: ${stats.relevantCount || 0} New Relevant Articles` : 'Relevant Headlines Found';
    let html = `<h1>${subject}</h1>`;
    if (isSupervisorReport) {
        html += `<p>Run finished. Fetched: ${stats.fetchedCount}, Fresh: ${stats.freshCount}, Relevant: ${stats.relevantCount}.</p>`;
    }
    html += `<h2>Articles:</h2><ul>${articles.map(a => `<li><b>(${a.relevance_article || a.relevance_headline || 'N/A'})</b> ${a.headline}</li>`).join('')}</ul>`;
    
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    await transporter.sendMail({
        from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`, to: recipients, subject, html,
    });
    log('info', `Email sent to ${recipients}.`);
}


// --- 5. THE MAIN PIPELINE ---
export async function executePipeline() {
    const startTime = new Date();
    log('info', '======= EXECUTION STARTED (DAITANJS-FREE) =======');
    const runStats = { fetchedCount: 0, freshCount: 0, enrichedCount: 0, relevantCount: 0 };
    let finalArticles = [];

    try {
        const limit = pLimit(CONCURRENCY_LIMIT);

        // Step 1: Fetch all headlines
        const fetchPromises = SOURCES.map(source => limit(() => fetchHeadlinesFromSource(source)));
        const allHeadlines = (await Promise.all(fetchPromises)).flat();
        runStats.fetchedCount = allHeadlines.length;
        if (allHeadlines.length === 0) return;

        // Step 2: Filter fresh headlines
        const existing = await Article.find({ link: { $in: allHeadlines.map(h => h.link) } }).select('link').lean();
        const existingLinkSet = new Set(existing.map(a => a.link));
        const freshArticles = allHeadlines.filter(h => !existingLinkSet.has(h.link));
        runStats.freshCount = freshArticles.length;
        if (freshArticles.length === 0) return;

        // Step 3: Assess headlines
        const assessedHeadlines = await assessWithMockAI(freshArticles, 'headlines');

        // Step 4: Filter for relevant headlines
        const relevantHeadlines = assessedHeadlines.filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD);
        if (relevantHeadlines.length === 0) return;

        // Step 5: Enrich relevant headlines with full article content
        const enrichmentPromises = relevantHeadlines.map(article => {
            const sourceConfig = SOURCES.find(s => s.newspaper === article.newspaper);
            return limit(() => enrichArticleWithContent(article, sourceConfig));
        });
        const enrichedArticles = await Promise.all(enrichmentPromises);
        runStats.enrichedCount = enrichedArticles.filter(a => !a.enrichment_error).length;

        // Step 6: Assess full article content
        finalArticles = await assessWithMockAI(enrichedArticles, 'articles');

        // Step 7: Save all processed articles to the database
        if (finalArticles.length > 0) {
            await Article.insertMany(finalArticles, { ordered: false }).catch(() => {});
            log('info', `Saved ${finalArticles.length} processed articles to the database.`);
        }

        // Step 8: Email the final, relevant articles
        const articlesForEmail = finalArticles.filter(a => a.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD);
        runStats.relevantCount = articlesForEmail.length;
        if (articlesForEmail.length > 0) {
            await sendEmail(articlesForEmail, false);
        }

    } catch (error) {
        log('error', 'A critical error occurred in the pipeline.', { message: error.message, stack: error.stack });
    } finally {
        const duration = ((new Date() - startTime) / 1000).toFixed(2);
        log('info', `Sending supervisor report.`);
        await sendEmail(finalArticles, true, runStats);
        log('info', `======= EXECUTION FINISHED in ${duration} seconds =======`);
    }
}