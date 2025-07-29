// src/modules/email/components/eventFormatter.js
import { logger } from '../../../utils/logger.js';

function createEventBriefCard(event) {
    const {
        synthesized_headline,
        synthesized_summary,
        ai_assessment_reason, // New property
        source_articles,
        highest_relevance_score,
        key_individuals
    } = event;

    const scoreColor = highest_relevance_score >= 80 ? '#27ae60' : highest_relevance_score >= 50 ? '#f39c12' : '#c0392b';

    const contactsHtml = (key_individuals && key_individuals.length > 0)
        ? `<div style="padding:10px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 15px; font-size: 14px; color: #333;">
             <strong>Key Individuals:</strong> ${key_individuals.map(p => {
                const emailPart = p.email_suggestion ? ` (<a href="mailto:${p.email_suggestion}" style="color: #007bff; text-decoration:none;">${p.email_suggestion}</a>)` : '';
                return `${p.name} - <i>${p.role_in_event}</i>${emailPart}`;
             }).join('; ')}
           </div>`
        : '';
    
    // NEW: HTML block for the AI's reasoning
    const reasoningHtml = ai_assessment_reason 
        ? `<div style="margin-top: 15px; padding-left: 10px; border-left: 2px solid #eeeeee; font-size: 12px; color: #666666; font-style: italic;">
             <strong>AI Reasoning:</strong> ${ai_assessment_reason}
           </div>`
        : '';

    const sourcesHtml = source_articles.map(article => `
        <tr style="vertical-align: top;">
            <td style="padding: 4px 8px 4px 0; color: #555; font-weight: bold; white-space: nowrap;">${article.newspaper}:</td>
            <td style="padding: 4px 0;">
                <a href="${article.link}" style="color: #007bff; text-decoration: none; font-size: 14px;">${article.headline}</a>
            </td>
        </tr>
    `).join('');

    return `
    <div style="border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 25px; padding: 20px; background-color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h2 style="margin-top: 0; margin-bottom: 15px; font-size: 20px; color: #1a1a1a;">
           <span style="font-weight: bold; color: ${scoreColor};">[${highest_relevance_score}]</span> ${synthesized_headline}
        </h2>
        
        <p style="margin: 0 0 15px; font-size: 15px; color: #555; line-height: 1.6;">${synthesized_summary}</p>
        
        ${contactsHtml}

        ${reasoningHtml}

        <h4 style="margin-top: 20px; margin-bottom: 10px; font-size: 14px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px;">Source Articles</h4>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">${sourcesHtml}</table>
    </div>
    `;
}

export function formatEventForEmail(event) {
    if (!event || typeof event !== 'object' || !event.synthesized_headline) {
        logger.warn(`formatEventForEmail: Invalid event object provided.`, { eventPreview: event });
        return `<p style="color:red;">Error: Event data was invalid.</p>`;
    }

    try {
        return createEventBriefCard(event);
    } catch (error) {
        logger.error(`Error creating event card for email: "${event.synthesized_headline}"`, { errorMessage: error.message });
        return `<p style="color:red;">Error formatting event: ${event.synthesized_headline}</p>`;
    }
}