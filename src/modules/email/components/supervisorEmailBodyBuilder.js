// src/modules/email/components/supervisorEmailBodyBuilder.js (version 2.0)
import { logger } from '../../../utils/logger.js';
import { SUPERVISOR_EMAIL_CONFIG, HEADLINES_RELEVANCE_THRESHOLD, ARTICLES_RELEVANCE_THRESHOLD } from '../../../config/index.js';
import { truncateString } from '../../../utils/helpers.js';
import { LOGO_URL } from '../constants.js';

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, "'")
         .replace(/'/g, "'");
}

function getArticleStatusForReport(article) {
    if (!article || typeof article !== 'object') return 'Invalid Article Data';
    if (article.storage_error_initial_headline_data) return `Storage Error: ${truncateString(String(article.storage_error_initial_headline_data), 40)}`;
    if (article.error) return `Processing Error: ${truncateString(String(article.error), 40)}`;
    if (article.enrichment_error) return `Enrichment Error: ${truncateString(String(article.enrichment_error), 40)}`;
    
    const headlineRelevant = article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD;
    const articleRelevant = article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD;

    if (articleRelevant) return 'Relevant (Full Article)';
    if (headlineRelevant && !articleRelevant) return 'Headline Relevant, Content Not';
    if (headlineRelevant) return 'Headline Relevant, Content Not Assessed';
    return 'Low Headline Relevance';
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

export function createSupervisorEmailBody(allProcessedArticles, runStats) {
    const runTimestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Copenhagen' });
    
    let statsHtml = `<h2>Run Statistics</h2><ul>`;
    for (const [key, value] of Object.entries(runStats)) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        statsHtml += `<li><strong>${formattedKey}:</strong> ${value}</li>`;
    }
    statsHtml += `</ul>`;

    const sortedArticles = [...allProcessedArticles].sort((a, b) => (b.relevance_article || b.relevance_headline || 0) - (a.relevance_article || a.relevance_headline || 0));

    let articlesTableHtml = `<h2>Processed Articles Details</h2>
    <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background-color: #f8f8f8;">
            <tr>
                <th>Headline</th><th>Source</th><th>HL Score</th><th>Art. Score</th><th>Status/Error</th><th>Emailed?</th>
            </tr>
        </thead>
        <tbody>`;

    if (sortedArticles.length > 0) {
        sortedArticles.forEach(article => {
            articlesTableHtml += `
            <tr>
                <td><a href="${escapeHtml(article.link)}">${truncateString(escapeHtml(article.headline), 60)}</a></td>
                <td>${escapeHtml(article.newspaper)}</td>
                <td>${article.relevance_headline ?? 'N/A'}</td>
                <td>${article.relevance_article ?? 'N/A'}</td>
                <td>${escapeHtml(getArticleStatusForReport(article))}</td>
                <td>${article.emailed ? 'Yes' : (article.email_skipped_reason || 'No')}</td>
            </tr>`;
        });
    } else {
        articlesTableHtml += `<tr><td colspan="6">No articles were processed in this run.</td></tr>`;
    }
    articlesTableHtml += `</tbody></table>`;
    
    const bodyContent = `
        <div style="text-align:center;"><img src="${LOGO_URL}" alt="Logo" style="max-width:150px;"></div>
        <h1 style="text-align:center;">${SUPERVISOR_EMAIL_CONFIG.subject}</h1>
        <p style="text-align:center;">Run completed: ${runTimestamp}</p>
        ${statsHtml}
        ${articlesTableHtml}
        <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #888888;">
            <p>This is an automated report from the ${SUPERVISOR_EMAIL_CONFIG.brandName}.</p>
        </div>
    `;

    return createSupervisorEmailWrapper(bodyContent);
}