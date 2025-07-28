// src/modules/email/components/supervisorEmailBodyBuilder.js
import { SUPERVISOR_EMAIL_CONFIG, HEADLINES_RELEVANCE_THRESHOLD } from '../../../config/index.js';
import { LOGO_URL } from '../constants.js';
import { truncateString } from '../../../utils/helpers.js';
import Article from '../../../../models/Article.js';
import SynthesizedEvent from '../../../../models/SynthesizedEvent.js';

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "'")
         .replace(/'/g, "'");
}

function createSupervisorEmailWrapper(bodyContent) {
    return `
    <!DOCTYPE html>
    <html>
    <head><title>${SUPERVISOR_EMAIL_CONFIG.subject}</title></head>
    <body style="font-family: sans-serif; background-color: #f0f0f0; padding: 20px;">
        <table width="95%" border="0" cellspacing="0" cellpadding="20" style="max-width: 1200px; margin: auto; background-color: #ffffff;">
            <tr><td>${bodyContent}</td></tr>
        </table>
    </body>
    </html>`;
}

function createScraperHealthTable(healthStats) {
    if (!healthStats || healthStats.length === 0) return '';

    let table = `<h2>Scraper Health Check</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background-color: #f8f8f8;"><tr><th>Source</th><th>Status</th><th>Articles Found</th></tr></thead><tbody>`;
    
    healthStats.sort((a, b) => a.source.localeCompare(b.source));

    for (const stat of healthStats) {
        const status = stat.success ? '✅ OK' : '❌ FAILED';
        const statusColor = stat.success ? 'green' : 'red';
        table += `<tr>
                <td>${escapeHtml(stat.source)}</td>
                <td style="color: ${statusColor};">${status}</td>
                <td>${stat.count}</td>
            </tr>`;
    }
    table += `</tbody></table>`;
    return table;
}

async function createEventsTableHtml(runStartDate) {
    const recentEvents = await SynthesizedEvent.find({ createdAt: { $gte: runStartDate }})
                                                 .sort({ createdAt: -1 })
                                                 .limit(50)
                                                 .lean();
    if (recentEvents.length === 0) return `<h2>Synthesized Events from this Run</h2><p>No events were synthesized in this run.</p>`;

    let table = `<h2>Synthesized Events from this Run</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background-color: #f8f8f8;"><tr><th>Synthesized Headline</th><th>Score</th><th>Sources</th><th>Key Individuals</th><th>Emailed?</th></tr></thead><tbody>`;
    for (const event of recentEvents) {
        const sources = event.source_articles.map(a => a.newspaper).join(', ');
        const individuals = event.key_individuals.map(p => p.name).join(', ') || 'N/A';
        table += `<tr>
                <td>${truncateString(escapeHtml(event.synthesized_headline), 80)}</td>
                <td>${event.highest_relevance_score}</td>
                <td>${escapeHtml(sources)}</td>
                <td>${escapeHtml(individuals)}</td>
                <td>${event.emailed ? 'Yes' : 'No'}</td>
            </tr>`;
    }
    table += `</tbody></table>`;
    return table;
}

async function createArticlesTableHtml(runStartDate) {
    const freshArticles = await Article.find({ createdAt: { $gte: runStartDate }})
                                         .sort({ relevance_headline: -1 })
                                         .limit(100)
                                         .lean();
    if (freshArticles.length === 0) return `<h2>All Fresh Articles Processed</h2><p>No new raw articles were processed.</p>`;

    let table = `<h2>All Fresh Articles Processed in this Run</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background-color: #f8f8f8;"><tr><th>Headline</th><th>Source</th><th>HL Score</th><th>Status</th></tr></thead><tbody>`;
    for (const article of freshArticles) {
        const status = article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD ? 'Relevant for Enrichment' : 'Low Relevance';
        table += `<tr>
                <td><a href="${article.link}">${truncateString(escapeHtml(article.headline), 80)}</a></td>
                <td>${escapeHtml(article.newspaper)}</td>
                <td>${article.relevance_headline}</td>
                <td>${status}</td>
            </tr>`;
    }
    table += `</tbody></table>`;
    return table;
}


export async function createSupervisorEmailBody(runStats) {
    const runTimestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Copenhagen' });
    const runStartDate = new Date(Date.now() - 5 * 60 * 1000); // Assume run started in last 5 mins for querying
    
    let statsHtml = `<h2>Run Statistics</h2><ul>`;
    const statOrder = ['headlinesScraped', 'freshHeadlinesFound', 'headlinesAssessed', 'relevantHeadlines', 'articlesEnriched', 'eventsClustered', 'eventsSynthesized', 'eventsEmailed', 'errors'];
    for (const key of statOrder) {
        if (runStats.hasOwnProperty(key)) {
            const value = runStats[key];
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            statsHtml += `<li><strong>${formattedKey}:</strong> ${Array.isArray(value) && value.length === 0 ? '0' : (Array.isArray(value) ? value.join(', ') : value)}</li>`;
        }
    }
    statsHtml += `</ul>`;

    const scraperHealthHtml = createScraperHealthTable(runStats.scraperHealth);
    
    const [eventsTableHtml, articlesTableHtml] = await Promise.all([
        createEventsTableHtml(runStartDate),
        createArticlesTableHtml(runStartDate)
    ]);
    
    const bodyContent = `
        <div style="text-align:center;"><img src="${LOGO_URL}" alt="Logo" style="max-width:150px;"></div>
        <h1 style="text-align:center;">${SUPERVISOR_EMAIL_CONFIG.subject}</h1>
        <p style="text-align:center;">Run completed: ${runTimestamp}</p>
        ${statsHtml}
        ${scraperHealthHtml}
        ${eventsTableHtml}
        ${articlesTableHtml}
        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #888888;">
            <p>This is an automated report from the ${SUPERVISOR_EMAIL_CONFIG.brandName}.</p>
        </div>
    `;

    return createSupervisorEmailWrapper(bodyContent);
}