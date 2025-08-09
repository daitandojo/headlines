// src/modules/email/components/eventFormatter.js (version 2.0)
// src/modules/email/components/eventFormatter.js
import { logger } from '../../../utils/logger.js';

function createEventBriefCard(event) {
    const {
        synthesized_headline,
        synthesized_summary,
        ai_assessment_reason,
        source_articles,
        highest_relevance_score,
        key_individuals
    } = event;

    const scoreColor = highest_relevance_score >= 80 ? '#4CAF50' : highest_relevance_score >= 50 ? '#FFC107' : '#F44336';
    const scoreTextShadow = `0 0 8px ${scoreColor}40`;

    const contactsHtml = (key_individuals && key_individuals.length > 0)
        ? `<tr>
             <td style="padding: 16px 0 8px; border-top: 1px solid #444444;">
                 <p style="margin:0; font-size: 14px; color: #D4AF37; font-weight: 600;">Key Individuals</p>
                 <p style="margin:8px 0 0 0; font-size: 14px; color: #cccccc; line-height: 1.6;">
                    ${key_individuals.map(p => {
                        const emailPart = p.email_suggestion ? ` (<a href="mailto:${p.email_suggestion}" style="color: #66b3ff; text-decoration:none;">${p.email_suggestion}</a>)` : '';
                        return `${p.name} — <span style="color:#a0a0a0;">${p.role_in_event}</span>${emailPart}`;
                    }).join('<br>')}
                 </p>
             </td>
           </tr>`
        : '';
    
    const reasoningHtml = ai_assessment_reason 
        ? `<tr>
             <td style="padding-top: 16px;">
                <p style="margin:0; font-size: 13px; color: #a0a0a0; font-style: italic; line-height: 1.5; border-left: 2px solid #D4AF37; padding-left: 12px;">
                    <strong>AI Reasoning:</strong> ${ai_assessment_reason}
                </p>
             </td>
           </tr>`
        : '';

    const sourcesHtml = source_articles.map(article => `
        <tr style="vertical-align: top;">
            <td style="padding: 5px 0; border-bottom: 1px solid #383838;">
                <a href="${article.link}" target="_blank" style="color: #cccccc; text-decoration: none; font-size: 14px; display: block;">
                    <span style="font-weight: 500; color: #ffffff;">${article.headline}</span><br>
                    <span style="font-size: 12px; color: #a0a0a0;">${article.newspaper}</span>
                </a>
            </td>
        </tr>
    `).join('');

    return `
    <div style="background-color: #1E1E1E; border-radius: 12px; margin-bottom: 25px; padding: 25px; border: 1px solid #333333; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
        <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
            <!-- Score & Headline -->
            <tr>
                <td style="padding-bottom: 15px;">
                    <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
                        <tr>
                            <td style="width: 60px; vertical-align: top;" valign="top">
                                <p style="font-size: 28px; font-weight: 700; color: ${scoreColor}; margin: 0; text-shadow: ${scoreTextShadow};">${highest_relevance_score}</p>
                                <p style="font-size: 12px; color: #a0a0a0; margin: 0;">Score</p>
                            </td>
                            <td style="padding-left: 20px;">
                                <h2 style="margin:0; font-size: 20px; font-weight: 600; color: #EAEAEA; line-height: 1.4;">${synthesized_headline}</h2>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <!-- Summary -->
            <tr>
                <td style="padding-bottom: 20px;">
                    <p style="margin:0; font-size: 16px; color: #cccccc; line-height: 1.7;">${synthesized_summary}</p>
                </td>
            </tr>
            
            ${contactsHtml}
            
            <!-- Sources -->
            <tr>
                <td style="padding: 16px 0 8px; border-top: 1px solid #444444;">
                    <p style="margin:0; font-size: 14px; color: #D4AF37; font-weight: 600;">Source Articles</p>
                </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">${sourcesHtml}</table>
              </td>
            </tr>

            ${reasoningHtml}
        </table>
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