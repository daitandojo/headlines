// src/modules/email/components/emailBodyBuilder.js (version 2.0)
// src/modules/email/components/emailBodyBuilder.js
import { logger } from '../../../utils/logger.js';
import { EMAIL_CONFIG } from '../../../config/index.js';
import { LOGO_URL } from '../constants.js';
import { formatEventForEmail } from './eventFormatter.js';
import { countryNameToFlagMap } from '../../../config/sources.js';

function createEmailWrapper(bodyContent, subject) {
    // This is a comprehensive wrapper designed for maximum email client compatibility.
    // It includes a <style> block for modern clients and uses inline styles for fallbacks.
    return `
    <!DOCTYPE html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <title>${subject}</title>
        <!--[if mso]>
        <noscript>
            <xml>
                <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
            </xml>
        </noscript>
        <![endif]-->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            table, td, div, h1, h2, h3, p { font-family: 'Lexend', sans-serif; }
            body { margin: 0; padding: 0; }
            .content-table { width: 100%; max-width: 640px; }
            .main-background { background-color: #1a1a1a; }
            .content-background { background-color: #2a2a2a; }
            .main-heading { color: #ffffff; font-weight: 600; }
            .paragraph { color: #cccccc; line-height: 1.7; }
            .footer-text { color: #888888; }
            .button { 
                background-color: #D4AF37 !important;
                color: #1a1a1a !important; 
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                display: inline-block;
                transition: opacity 0.3s ease;
            }
            .button a {
                color: #1a1a1a !important;
                text-decoration: none;
            }
            .button:hover {
                opacity: 0.85;
            }
            @media screen and (max-width: 600px) {
                .content-table { width: 100% !important; }
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0;">
        <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;" class="main-background">
            <tr>
                <td align="center" style="padding:20px 0;">
                    ${bodyContent}
                </td>
            </tr>
        </table>
    </body>
    </html>`;
}

export function createPersonalizedEmailBody(user, eventsByCountry, subject) {
    if (!user || !eventsByCountry || Object.keys(eventsByCountry).length === 0) {
        logger.warn('createPersonalizedEmailBody: Missing user or events data.');
        return null;
    }

    let formattedEventsHtml = '';
    for (const [country, events] of Object.entries(eventsByCountry)) {
        const flag = countryNameToFlagMap.get(country) || '🌍';
        formattedEventsHtml += `
        <tr>
          <td style="padding: 30px 0 10px 0;">
            <h2 style="margin:0; font-size: 24px; font-weight: 500; color: #EAEAEA;">${flag} ${country}</h2>
          </td>
        </tr>
      `;
        formattedEventsHtml += events.map(event => `<tr><td>${formatEventForEmail(event)}</td></tr>`).join('');
    }

    const mainContent = `
    <!--[if mso | IE]>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="content-table" align="center">
    <tr>
      <td style="padding:40px 30px;">
    <![endif]-->
    <div class="content-table" style="margin:0 auto;">
      <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
          <!-- Header -->
          <tr>
              <td align="center" style="padding:20px 0;">
                  <img src="${LOGO_URL}" alt="${EMAIL_CONFIG.brandName} Logo" width="60" style="height:auto;display:block;">
                  <p style="font-size: 14px; font-weight: 500; color: #D4AF37; margin-top: 10px; margin-bottom: 0;">WEALTH INSIGHT</p>
              </td>
          </tr>
          <!-- Body -->
          <tr>
              <td style="padding:36px 30px;" class="content-background">
                  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
                      <tr>
                          <td>
                              <h1 class="main-heading" style="margin:0 0 20px 0; font-size: 28px;">${subject}</h1>
                              <p class="paragraph" style="margin:0 0 25px 0; font-size: 16px;">Hi ${user.firstName},</p>
                              <p class="paragraph" style="margin:0 0 25px 0; font-size: 16px;">Here are the latest relevant wealth events we have identified based on your subscribed regions.</p>
                          </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding: 10px 0 30px 0;">
                           <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                              <tr>
                                 <td class="button" style="padding:14px 28px;">
                                    <a href="https://headlines-client.vercel.app" target="_blank" style="font-size: 16px;">View Full Dashboard</a>
                                 </td>
                              </tr>
                           </table>
                        </td>
                      </tr>
                      ${formattedEventsHtml}
                  </table>
              </td>
          </tr>
          <!-- Footer -->
          <tr>
              <td style="padding:30px;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;border:0;border-spacing:0;">
                      <tr>
                          <td align="center">
                              <p class="footer-text" style="margin:0;font-size:12px;">${EMAIL_CONFIG.brandName} | ${EMAIL_CONFIG.companyAddress}</p>
                              <p class="footer-text" style="margin:10px 0 0 0;font-size:12px;"><a href="${EMAIL_CONFIG.unsubscribeUrl}" style="color:#888888;text-decoration:underline;">Unsubscribe</a></p>
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </table>
    </div>
    <!--[if mso | IE]>
      </td>
    </tr>
    </table>
    <![endif]-->
    `;

    return createEmailWrapper(mainContent, subject);
}