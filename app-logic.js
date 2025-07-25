// This is the new, robust pipeline logic, based on the successful test-pipeline.js
// It uses standard libraries to avoid the native crash from the DaitanJS framework.
import mongoose from 'mongoose';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';
import { getLogger } from '@daitanjs/development';
import { SOURCES, HEADLINES_RELEVANCE_THRESHOLD, ARTICLES_RELEVANCE_THRESHOLD, SMTP_CONFIG, HEADLINE_RECIPIENTS, SUPERVISOR_EMAIL } from './src/config/index.js';
import { generateIntelligence } from '@daitanjs/intelligence';
import { instructionHeadlines, shotsHeadlinesInput, shotsHeadlinesOutput } from './src/modules/assessments/instructionHeadlines.js'; // Assuming you want to keep these
// You will need to re-create the assessment and enrichment logic using standard tools if you want to go further.
// For now, we will use a simplified version.

const pipelineLogger = getLogger('headlines-mongo-pipeline');

async function fetchHeadlinesFromSource(source) {
    pipelineLogger.info(`Fetching from ${source.name} using axios...`);
    try {
        const { data: html } = await axios.get(source.startUrl, {
            timeout: 25000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const dom = new JSDOM(html);
        const document = dom.window.document;
        const links = [...document.querySelectorAll(source.linkSelector)];
        const headlines = links.map(link => ({
            headline: link.textContent.trim(),
            link: new URL(link.getAttribute('href'), source.baseUrl).href,
            newspaper: source.newspaper,
            source: source.name,
        })).filter(h => h.headline && h.headline.length > 15);
        
        pipelineLogger.info(`Found ${headlines.length} headlines from ${source.name}.`);
        return headlines;
    } catch (error) {
        pipelineLogger.error(`Failed to fetch from ${source.name}`, { message: error.message });
        return [];
    }
}

// MOCK AI Function - This is a placeholder. You would replace this with a real call to your AI library.
// Since @daitanjs/intelligence seems to be one of the safe imports, we can try using it.
async function assessHeadlinesWithAI(articles) {
    pipelineLogger.info(`Assessing ${articles.length} headlines with AI...`);
    // This is a simplified version of your original logic.
    const headlines = articles.map(a => a.headline);
    const userPromptString = `Please assess the following headlines:\n- ${headlines.join('\n- ')}`;

    // This part might still be problematic if the intelligence lib is the issue,
    // but we can test it. If it fails, we replace it with a direct API call.
    const { response } = await generateIntelligence({
        prompt: { system: instructionHeadlines, user: userPromptString },
        config: { response: { format: 'json' } },
    });
    
    if (response && response.assessment && Array.isArray(response.assessment)) {
        return articles.map((article, index) => ({
            ...article,
            relevance_headline: response.assessment[index]?.relevance_headline || 0,
            assessment_headline: response.assessment[index]?.assessment_headline || 'AI assessment failed to return valid data.',
        }));
    }
    return articles.map(a => ({ ...a, relevance_headline: 0, assessment_headline: 'AI response was invalid.' }));
}

export async function executePipeline() {
    pipelineLogger.info('======= ROBUST PIPELINE EXECUTION STARTING =======');
    try {
        const Article = mongoose.model('Article');

        // 1. Fetch
        pipelineLogger.info('--- Step 1: Fetching Headlines ---');
        const fetchPromises = SOURCES.map(fetchHeadlinesFromSource);
        const headlinesResults = await Promise.all(fetchPromises);
        const headlines = headlinesResults.flat();
        if (headlines.length === 0) {
            pipelineLogger.warn('No headlines fetched. Ending pipeline.');
            return;
        }

        // 2. Filter Fresh
        pipelineLogger.info(`--- Step 2: Filtering ${headlines.length} headlines against DB ---`);
        const existingLinks = await Article.find({ link: { $in: headlines.map(h => h.link) } }).select('link').lean();
        const existingLinkSet = new Set(existingLinks.map(a => a.link));
        const freshArticles = headlines.filter(h => !existingLinkSet.has(h.link));
        pipelineLogger.info(`Found ${freshArticles.length} fresh articles.`);
        if (freshArticles.length === 0) {
            pipelineLogger.warn('No fresh articles found. Ending pipeline.');
            return;
        }

        // 3. Assess Headlines
        pipelineLogger.info('--- Step 3: Assessing Headlines with AI ---');
        const assessedArticles = await assessHeadlinesWithAI(freshArticles);

        // NOTE: Enrichment and Article Assessment steps are omitted for this robust test.
        // They would be built here using axios/jsdom for enrichment and another AI call.

        // 4. Send Email
        pipelineLogger.info('--- Step 4: Checking for relevant articles to email ---');
        const relevantArticles = assessedArticles.filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD);
        if (relevantArticles.length > 0) {
            pipelineLogger.info(`Found ${relevantArticles.length} relevant articles. Sending email...`);
            const transporter = nodemailer.createTransport(SMTP_CONFIG);
            await transporter.sendMail({
                from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
                to: HEADLINE_RECIPIENTS.join(','),
                subject: 'Relevant Headlines Found (Robust Pipeline)',
                html: `<h1>Headlines</h1><ul>${relevantArticles.map(a => `<li><b>(${a.relevance_headline})</b> ${a.headline}</li>`).join('')}</ul>`,
            });
            pipelineLogger.info('SUCCESS: Email sent!');
        } else {
            pipelineLogger.info('No relevant articles found to email.');
        }

        pipelineLogger.info('======= ROBUST PIPELINE FINISHED SUCCESSFULLY =======');
    } catch (error) {
        pipelineLogger.error('A critical error occurred in the robust pipeline.', { message: error.message, stack: error.stack });
    }
}