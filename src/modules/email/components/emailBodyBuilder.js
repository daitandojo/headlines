// File: headlines_mongo/src/modules/email/components/emailBodyBuilder.js
import {
  createEmailWrapper,
  createEmailHeader,
  createEmailFooter,
  createHeading,
  createParagraph,
} from '@daitanjs/html';
import { getLogger } from '@daitanjs/development';
import { EMAIL_CONFIG } from '../../../config/index.js';
import { LOGO_URL } from '../constants.js';
import { formatArticleForEmail } from './articleFormatter.js';

const logger = getLogger('headlines-mongo-email-bodybuilder');

export function createEmailBody(articles, appEmailConfig = EMAIL_CONFIG) {
  if (!Array.isArray(articles) || articles.length === 0) {
    logger.warn('createEmailBody: No articles provided. Cannot create email body.');
    return null;
  }

  logger.info(`Constructing email body for ${articles.length} wealth event articles.`);
  
  const formattedArticlesHtml = articles
    .map((article) => formatArticleForEmail(article, appEmailConfig))
    .filter(Boolean)
    .join('');

  if (!formattedArticlesHtml.trim()) {
    logger.warn('createEmailBody: All articles failed to format. No content for email body.');
    return null;
  }

  const headerHtml = createEmailHeader({
    logoUrl: LOGO_URL,
    logoAlt: `${appEmailConfig.brandName || 'Wealth Watch'} Logo`,
    customStyles: { textAlign: 'center', paddingBottom: '20px' },
  });

  const mainContent = `
    ${headerHtml}
    ${createHeading({
      text: appEmailConfig.subject,
      level: 1,
      customStyles: {
        color: appEmailConfig.headingColor,
        textAlign: 'center',
        marginBottom: '25px',
        fontSize: '24px',
        lineHeight: '1.3',
      },
    })}
    ${createParagraph({
      text: `Good morning! Here are the latest potential wealth events and insights identified by our system. ${articles.length} item(s) met the criteria for closer review:`,
      customStyles: { marginBottom: '30px', textAlign: 'left' },
    })}
    ${formattedArticlesHtml}
    ${createParagraph({
      text: "Please review these leads and take appropriate action.",
      customStyles: { marginTop: '30px', marginBottom: '15px', textAlign: 'left' },
    })}
    ${createParagraph({
      text: 'Best Regards,<br>The Wealth Insight Team',
      customStyles: { marginTop: '20px', textAlign: 'left' },
    })}
  `;

  const footerHtml = createEmailFooter({
    companyName: appEmailConfig.brandName || 'Wealth Watch Denmark',
    address: appEmailConfig.companyAddress,
    unsubscribeUrl: appEmailConfig.unsubscribeUrl,
    textStyles: { color: appEmailConfig.footerTextColor },
    linkStyles: { color: appEmailConfig.footerLinkColor },
  });

  const fullEmailBody = `${mainContent}${footerHtml}`;

  try {
    return createEmailWrapper({
      bodyContent: fullEmailBody,
      config: appEmailConfig,
    });
  } catch (error) {
    logger.error('Error constructing email body with createEmailWrapper:', { errorMessage: error.message });
    return null;
  }
}