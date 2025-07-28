// src/modules/email/components/emailBodyBuilder.js
import { logger } from '../../../utils/logger.js';
import { EMAIL_CONFIG } from '../../../config/index.js';
import { LOGO_URL } from '../constants.js';
import { formatEventForEmail } from './eventFormatter.js';

function createEmailWrapper(bodyContent) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${EMAIL_CONFIG.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
            <tr>
                <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="20" style="max-width: 600px; width: 100%; background-color: #ffffff; margin-top: 20px; margin-bottom: 20px;">
                        <tr>
                            <td>
                                ${bodyContent}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;
}

export function createEmailBody(events) {
    if (!Array.isArray(events) || events.length === 0) {
        logger.warn('createEmailBody: No events provided to build email body.');
        return null;
    }

    const formattedEventsHtml = events.map(formatEventForEmail).join('');

    const mainContent = `
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eeeeee;">
            <img src="${LOGO_URL}" alt="${EMAIL_CONFIG.brandName} Logo" style="max-width: 150px; height: auto;">
        </div>
        <h1 style="color: #333333; text-align: center; margin-top: 20px;">${EMAIL_CONFIG.subject}</h1>
        <p style="font-size: 16px; color: #555555; text-align: left;">
            Good morning,
            <br><br>
            Here are the latest potential wealth events identified and synthesized by the system:
        </p>
        ${formattedEventsHtml}
        <p style="font-size: 16px; color: #555555; text-align: left;">
            Best Regards,<br>The Wealth Insight Team
        </p>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888;">
            <p>${EMAIL_CONFIG.brandName} | ${EMAIL_CONFIG.companyAddress}</p>
            <p><a href="${EMAIL_CONFIG.unsubscribeUrl}" style="color: #888888;">Unsubscribe</a></p>
        </div>
    `;

    return createEmailWrapper(mainContent);
}