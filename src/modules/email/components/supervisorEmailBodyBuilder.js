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


// --- MODIFIED: This function now creates detailed cards instead of a simple table ---
function createEnrichmentFunnelHtml(enrichmentOutcomes) {
    if (!enrichmentOutcomes || enrichmentOutcomes.length === 0) {
        return '<h2>Enrichment Funnel</h2><p>No headlines were relevant enough for enrichment.</p>';
    }

    let cardsHtml = `<h2>Enrichment Funnel Audit Trail</h2>
    <p>Complete lifecycle of every headline that scored ≥ ${HEADLINES_RELEVANCE_THRESHOLD}.</p>`;

    // Sort to show successful items first, then by score
    enrichmentOutcomes.sort((a, b) => {
        if (a.outcome === 'Success' && b.outcome !== 'Success') return -1;
        if (a.outcome !== 'Success' && b.outcome === 'Success') return 1;
        return (b.headlineScore || 0) - (a.headlineScore || 0);
    });

    for (const item of enrichmentOutcomes) {
        const isSuccess = item.outcome === 'Success';
        const statusColor = isSuccess ? '#27ae60' : '#c0392b'; // green or red
        const statusIcon = isSuccess ? '✅' : '❌';

        cardsHtml += `
        <div style="border: 1px solid #ccc; border-left: 5px solid ${statusColor}; margin-bottom: 20px; padding: 15px; background-color: #f9f9f9;">
            <h4 style="margin-top: 0; margin-bottom: 10px; font-size: 16px;">
                <a href="${item.link}" style="color: #007bff; text-decoration:none;">${escapeHtml(item.headline)}</a>
            </h4>
            <p style="margin: 0 0 10px;">
                <strong>${statusIcon} Status:</strong> <span style="font-weight: bold; color: ${statusColor};">${item.outcome}</span>
            </p>
            <div style="font-size: 13px; line-height: 1.5;">
                <p style="margin: 0 0 5px;">
                    <strong>➡️ Stage 1 (Headline):</strong> Score [${item.headlineScore}] - <i>${escapeHtml(item.assessment_headline)}</i>
                </p>
                <p style="margin: 0 0 10px;">
                    <strong>➡️ Stage 2 (Content):</strong> Final Score [${item.finalScore ?? 'N/A'}] - <span style="font-style: italic;">${escapeHtml(item.assessment_article)}</span>
                </p>
                <div style="padding: 10px; background-color: #fff; border: 1px solid #eee; font-size: 11px; color: #555; max-height: 100px; overflow-y: auto;">
                    <strong>Article Snippet:</strong>
                    <p style="margin-top: 5px; margin-bottom: 0; white-space: pre-wrap; font-family: monospace;">${escapeHtml(item.content_snippet)}...</p>
                </div>
            </div>
        </div>
        `;
    }
    return cardsHtml;
}
// --- END MODIFICATION ---


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
    const runStartDate = new Date(Date.now() - 10 * 60 * 1000); // Widen window slightly to be safe
    
    let statsHtml = `<h2>Run Statistics</h2><ul>`;
    const statOrder = ['headlinesScraped', 'freshHeadlinesFound', 'headlinesAssessed', 'relevantHeadlines', 'articlesEnriched', 'relevantArticles', 'eventsClustered', 'eventsSynthesized', 'eventsEmailed', 'errors'];
    for (const key of statOrder) {
        if (runStats.hasOwnProperty(key)) {
            const value = runStats[key];
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            statsHtml += `<li><strong>${formattedKey}:</strong> ${Array.isArray(value) && value.length === 0 ? '0' : (Array.isArray(value) ? value.join(', ') : value)}</li>`;
        }
    }
    statsHtml += `</ul>`;

    const scraperHealthHtml = createScraperHealthTable(runStats.scraperHealth);
    
    const enrichmentFunnelHtml = createEnrichmentFunnelHtml(runStats.enrichmentOutcomes);

    const [eventsTableHtml, articlesTableHtml] = await Promise.all([
        createEventsTableHtml(runStartDate),
        createArticlesTableHtml(runStartDate)
    ]);
    
    const bodyContent = `
        <div style="text-align:center;"><img src="${LOGO_URL}" alt="Logo" style="max-width:150px;"></div>
        <h1 style="text-align:center;">${SUPERVISOR_EMAIL_CONFIG.subject}</h1>
        <p style="text-align:center;">Run completed: ${runTimestamp}</p>
        
        ${statsHtml}
        
        ${enrichmentFunnelHtml} <!-- The new, detailed audit trail -->
        
        ${eventsTableHtml}
        
        ${articlesTableHtml}
        
        ${scraperHealthHtml}

        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #888888;">
            <p>This is an automated report from the ${SUPERVISOR_EMAIL_CONFIG.brandName}.</p>
        </div>
    `;

    return createSupervisorEmailWrapper(bodyContent);
}