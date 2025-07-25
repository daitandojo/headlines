// A completely self-contained pipeline for testing on Fly.io
// It does NOT use any @daitanjs/* libraries for its core data processing logic.
import mongoose from 'mongoose';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';

// Use console.log for maximum reliability during this critical test.
const log = (level, message, data) => {
  const logData = data ? `| data: ${JSON.stringify(data).substring(0, 200)}` : '';
  console.log(`[TEST-PIPELINE] [${level.toUpperCase()}] - ${message} ${logData}`);
};

async function fetchHeadlinesWithAxios(source) {
  log('info', `Fetching from ${source.name} using axios...`);
  try {
    const { data: html } = await axios.get(source.startUrl, {
      timeout: 20000, // 20-second timeout
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const dom = new JSDOM(html);
    const document = dom.window.document;
    // Using a simpler, more generic selector for this test
    const links = [...document.querySelectorAll('a')];
    const headlines = links.map(link => ({
      headline: link.textContent.trim(),
      link: new URL(link.getAttribute('href'), source.baseUrl).href,
      newspaper: source.newspaper,
      source: source.name,
    })).filter(h => h.headline && h.headline.length > 15 && h.link.includes(source.baseUrl));
    
    log('info', `Found ${headlines.length} potential headlines from ${source.name}.`);
    return headlines.slice(0, 10); // Limit to 10 per source for the test
  } catch (error) {
    log('error', `Failed to fetch from ${source.name}`, { message: error.message });
    return [];
  }
}

// MOCK AI Function - we don't need to spend money to test the pipeline flow.
async function mockAssessHeadlines(articles) {
  log('info', 'Mocking AI headline assessment...');
  return articles.map(article => ({
    ...article,
    // Simple mock logic: if headline contains a common Danish business word, it's relevant.
    relevance_headline: (article.headline.toLowerCase().includes('aktier') || article.headline.toLowerCase().includes('milliarder')) ? 95 : 5,
    assessment_headline: 'This is a mock AI assessment.',
  }));
}

export async function executeTestPipeline() {
  log('info', '======= EXECUTE TEST PIPELINE STARTING =======');
  try {
    const Article = mongoose.model('Article');

    const sources = [
        { name: 'Børsen', newspaper: 'Borsen', baseUrl: 'https://borsen.dk', startUrl: 'https://borsen.dk/nyheder' },
        { name: 'Berlingske', newspaper: 'Berlingske', baseUrl: 'https://www.berlingske.dk', startUrl: 'https://www.berlingske.dk/business' },
    ];
    
    // 1. Fetch
    log('info', '--- Step 1: Fetching Headlines ---');
    const fetchPromises = sources.map(fetchHeadlinesWithAxios);
    const headlinesResults = await Promise.all(fetchPromises);
    const headlines = headlinesResults.flat();
    if (headlines.length === 0) {
      log('warn', 'No headlines fetched. Ending test pipeline.');
      return;
    }

    // 2. Filter Fresh
    log('info', `--- Step 2: Filtering ${headlines.length} headlines against DB ---`);
    const existingLinks = await Article.find({ link: { $in: headlines.map(h => h.link) } }).select('link').lean();
    const existingLinkSet = new Set(existingLinks.map(a => a.link));
    const freshArticles = headlines.filter(h => !existingLinkSet.has(h.link));
    log('info', `Found ${freshArticles.length} fresh articles.`);
    if (freshArticles.length === 0) {
      log('warn', 'No fresh articles found. Ending test pipeline.');
      return;
    }

    // 3. Assess (Mocked)
    log('info', '--- Step 3: Assessing Headlines (Mocked AI) ---');
    const assessedArticles = await mockAssessHeadlines(freshArticles);

    // 4. Send Email (if relevant)
    log('info', '--- Step 4: Checking for relevant articles to email ---');
    const relevantArticles = assessedArticles.filter(a => a.relevance_headline > 50);
    if (relevantArticles.length > 0) {
      log('info', `Found ${relevantArticles.length} relevant articles. Preparing to send email.`);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_ADDRESS}>`,
        to: process.env.HEADLINE_RECIPIENTS,
        subject: '[TEST PIPELINE] Relevant Headlines Found',
        html: `<h1>Test Succeeded</h1><p>Found ${relevantArticles.length} relevant articles.</p><ul>${relevantArticles.map(a => `<li>${a.headline}</li>`).join('')}</ul>`,
      });
      log('info', 'SUCCESS: Test email sent!');
    } else {
      log('info', 'No relevant articles found to email.');
    }
    log('info', '======= EXECUTE TEST PIPELINE FINISHED SUCCESSFULLY =======');
  } catch (error) {
    log('error', 'A critical error occurred in the test pipeline.', { message: error.message, stack: error.stack });
  }
}