// src/modules/email/components/articleFormatter.js (version 2.0)
import { logger } from '../../../utils/logger.js';
import { truncateString } from '../../../utils/helpers.js';

function createArticleCard(article) {
    const {
        link,
        headline,
        source,
        contacts,
        summary,
        assessmentText,
        relevanceScore,
        callToActionText,
    } = article;

    const scoreColor = relevanceScore >= 80 ? '#27ae60' : relevanceScore >= 50 ? '#f39c12' : '#c0392b';

    const contactsHtml = (contacts && contacts.length > 0)
        ? `<p style="margin: 0 0 15px; font-size: 14px; color: #555;"><strong>Contacts:</strong> ${contacts.join(', ')}</p>`
        : '';

    return `
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px; padding: 20px; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 18px; color: #333;">
            <a href="${link}" style="color: #007bff; text-decoration: none;">${headline}</a>
        </h3>
        <p style="margin: 0 0 15px; font-size: 14px; color: #777;"><strong>Source:</strong> ${source}</p>
        ${contactsHtml}
        <p style="margin: 0 0 15px; font-size: 15px; color: #555; line-height: 1.6;">${summary}</p>
        <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
            <p style="margin: 0; font-size: 14px; color: #333;">
                <strong>System Assessment:</strong> <span style="font-weight: bold; color: ${scoreColor};">[Score: ${relevanceScore}]</span> ${assessmentText}
            </p>
        </div>
        <a href="${link}" style="display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 15px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 14px;">
            ${callToActionText}
        </a>
    </div>
    `;
}

export function formatArticleForEmail(article) {
    if (!article || typeof article !== 'object' || !article.link || !article.headline) {
        logger.warn(`formatArticleForEmail: Invalid article object provided.`, { articlePreview: article });
        return `<p style="color:red;">Error: Article data was invalid.</p>`;
    }

    const genericArticleData = {
        link: article.link,
        headline: article.headline,
        source: article.source || article.newspaper || 'N/A',
        contacts: article.contacts || [],
        summary: 'No summary available.',
        assessmentText: article.assessment_article || article.assessment_headline || 'Assessment not available.',
        relevanceScore: article.relevance_article ?? article.relevance_headline ?? 'N/A',
        callToActionText: 'Read Full Article →',
    };

    if (article.articleContent && typeof article.articleContent === 'object') {
        const { contents } = article.articleContent;
        if (contents && Array.isArray(contents) && contents.length > 0) {
            genericArticleData.summary = truncateString(contents.join(' '), 250);
        }
    }
    
    if (genericArticleData.summary === 'No summary available.') {
      genericArticleData.summary = truncateString(genericArticleData.assessmentText, 250);
    }

    try {
        return createArticleCard(genericArticleData);
    } catch (error) {
        logger.error(`Error creating article card for email: "${article.headline}"`, { errorMessage: error.message });
        return `<p style="color:red;">Error formatting article: ${truncateString(article.headline, 50)}</p>`;
    }
}