import mongoose from 'mongoose';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';
import pLimit from 'p-limit';
import { SOURCES, HEADLINES_RELEVANCE_THRESHOLD, SMTP_CONFIG, HEADLINE_RECIPIENTS, SUPERVISOR_EMAIL, CONCURRENCY_LIMIT, DEFAULT_USER_AGENT } from './src/config/index.js';
import Article from './models/Article.js';

const log = (level, message, data) => {
  const logData = data ? `| data: ${JSON.stringify(data).substring(0, 200)}` : '';
  console.log(`[PIPELINE] [${level.toUpperCase()}] - ${message} ${logData}`);
};

async function fetchHeadlinesFromSource(source) {
    log('info', `Fetching from ${source.name}...`);
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

async function assessHeadlinesWithMockAI(articles) {
    log('info', `(MOCK AI) Assessing ${articles.length} headlines...`);
    return articles.map(article => ({
        ...article,
        relevance_headline: article.headline.toLowerCase().includes('milliard') ? 95 : 5,
        assessment_headline: 'This is a mock AI assessment.',
    }));
}

async function sendEmail(articles, isSupervisorReport = false, stats = {}) {
    if (!SMTP_CONFIG || !SMTP_CONFIG.auth || !SMTP_CONFIG.auth.user) {
        log('warn', 'SMTP not configured. Skipping email.');
        return;
    }
    const recipients = isSupervisorReport ? SUPERVISOR_EMAIL : (HEADLINE_RECIPIENTS || []).join(',');
    if (!recipients) {
        log('warn', `No recipients configured for ${isSupervisorReport ? 'supervisor' : 'main'} email.`);
        return;
    }
    const subject = isSupervisorReport ? `Pipeline Supervisor Report: ${stats.freshCount || 0} New` : 'Relevant Headlines Found';
    let html = `<h1>${subject}</h1>`;
    if (isSupervisorReport) {
        html += `<p>Run finished. Fetched: ${stats.fetchedCount}, Fresh: ${stats.freshCount}, Relevant: ${stats.relevantCount}.</p>`;
    }
    html += `<p>Found ${articles.length} articles.</p><ul>${articles.map(a => `<li><b>(${a.relevance_headline || 'N/A'})</b> ${a.headline}</li>`).join('')}</ul>`;
    const transporter = nodemailer.createTransport(SMTP_CONFIG);
    await transporter.sendMail({
        from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
        to: recipients,
        subject: subject,
        html: html,
    });
    log('info', `Email sent to ${recipients}.`);
}

export async function executePipeline() {
    const startTime = new Date();
    log('info', '======= EXECUTION STARTED (NO DAITANJS) =======');
    let runStats = { fetchedCount: 0, freshCount: 0, relevantCount: 0 };
    let allProcessedArticles = [];

    try {
        const limit = pLimit(CONCURRENCY_LIMIT);
        const fetchPromises = SOURCES.map(source => limit(() => fetchHeadlinesFromSource(source)));
        const allHeadlines = (await Promise.all(fetchPromises)).flat();
        runStats.fetchedCount = allHeadlines.length;
        if (allHeadlines.length === 0) return;

        const existingLinks = await Article.find({ link: { $in: allHeadlines.map(h => h.link) } }).select('link').lean();
        const existingLinkSet = new Set(existingLinks.map(a => a.link));
        const freshArticles = allHeadlines.filter(h => !existingLinkSet.has(h.link));
        runStats.freshCount = freshArticles.length;
        if (freshArticles.length === 0) return;

        allProcessedArticles = await assessHeadlinesWithMockAI(freshArticles);
        await Article.insertMany(allProcessedArticles, { ordered: false }).catch(() => {});

        const relevantArticles = allProcessedArticles.filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD);
        runStats.relevantCount = relevantArticles.length;
        if (relevantArticles.length > 0) {
            await sendEmail(relevantArticles, false);
        }
    } catch (error) {
        log('error', 'A critical error occurred in the pipeline.', { message: error.message, stack: error.stack });
    } finally {
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        log('info', `Sending supervisor report.`);
        await sendEmail(allProcessedArticles, true, runStats);
        log('info', `======= EXECUTION FINISHED in ${duration} seconds =======`);
    }
}