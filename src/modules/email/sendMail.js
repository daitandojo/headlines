import { composeEmail, createTemplate } from 'daitanjs/communication';
import {
  createHeading,
  createParagraph,
  createCard,
  createBlock,
  createFlexContainer,
  createFlexItem,
  createLabel,
} from 'daitanjs/html';
import { sendMail } from 'daitanjs/communication';
import {
  EMAIL_RECIPIENTS,
  EMAIL_CONFIG,
  SMTP_CONFIG,
} from '../../config/config.js';
import { getLogger } from 'daitanjs/development';

const logger = getLogger('email');

function setupEmailTemplate(articleObjects) {
  logger.debug('Setting up email template');
  const emailTemplate = createEmailTemplate(articleObjects);
  createTemplate(EMAIL_CONFIG.templateName, emailTemplate);
  logger.debug('Email template created successfully');
}

export async function sendWealthEventsEmail(articleObjects) {
  logger.info('Preparing to send wealth events email');

  if (!articleObjects || !Array.isArray(articleObjects)) {
    logger.error('articleObjects input is invalid or undefined', { articleObjects });
    throw new Error('articleObjects input must be a valid array');
  }

  logger.debug(`articleObjects received for email:`);
  articleObjects.forEach(a => {
    console.log(`${a.relevance_article} - ${a.topic}`)
  })

  setupEmailTemplate(articleObjects);

  const email = composeEmail({
    templateName: EMAIL_CONFIG.templateName,
    language: EMAIL_CONFIG.language,
    replacements: {},
    to: EMAIL_RECIPIENTS,
  });

  logger.debug('Composed email object', { email });

  try {
    logger.info('Attempting to send email...');
    await sendMail({
      emailObject: email,
      mailerConfig: SMTP_CONFIG,
    });
    logger.info('Denmark Banking Intelligence Report sent successfully');
    return articleObjects;
  } catch (error) {
    logger.error('Error sending email', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available',
    });
    throw error;
  }
}

function formatArticleForEmail(articleObject, config = EMAIL_CONFIG) {
  const {
    link,
    newspaper,
    topic,
    headline,
    articleContent,
    assessment_article,
    relevance_article,
    amount,
    contacts,
    background,
  } = articleObject;

  logger.debug(`Formatting article for email: ${headline}`);

  const articleBody = articleContent.headlines.join();
  const formattedArticle = `
    ${createHeading({
      text: `<a href="${link}">${topic || headline}</a>`,
      level: 3,
    })}
    <div style="display: flex; gap: 10px;">
      <img src="${config.articleImage || 'https://via.placeholder.com/100'}" alt="Article Image" style="width: 100px; height: auto; object-fit: cover;" />
      ${createParagraph({
        text: `<strong>Article in ${newspaper}: </strong><em>"${articleBody.substring(0, 150)}..."</em>`,
        fontSize: 14,
        color: config.paragraphColor,
      })}
    </div>
    ${createBlock({
      content: createParagraph({
        text: `<strong>Expert Insight:</strong> ${assessment_article} (${relevance_article})`,
        fontSize: 16,
      }),
      customStyles: {
        borderColor: config.cardBorderColor,
        backgroundColor: config.cardBackgroundColor,
        padding: '10px',
      },
    })}
    ${createFlexContainer({
      content: `
        ${
          amount > 0
            ? createFlexItem({
                content: `${createLabel({
                  text: 'Amount involved:',
                  forAttribute: '',
                })} <strong>$${amount}mm</strong>`,
              })
            : ''
        }
        ${
          contacts?.length
            ? createFlexItem({
                content: `${createLabel({
                  text: 'Key Contacts:',
                  forAttribute: '',
                })} ${contacts.map(contact => `<li>${contact}</li>`).join('')}`,
              })
            : ''
        }
      `,
    })}
    ${
      background
        ? createParagraph({
            text: `<strong>Background:</strong> ${background}`,
            fontSize: 14,
            color: config.paragraphColor,
          })
        : ''
    }
    <a href="${link}" style="display: block; margin-top: 10px; background-color: ${config.buttonColor}; color: white; text-align: center; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Read Full Article</a>
  `;
  return createCard({ content: formattedArticle });
}

function createEmailTemplate(articleObjects, config = EMAIL_CONFIG) {
  logger.debug(`Creating email template for ${articleObjects.length}`);

  const eventList = articleObjects.map((article) => formatArticleForEmail(article, config)).join('');

  return {
    subjectTemplate: {
      [config.language]: config.subject,
    },
    bodySections: {
      [config.language]: [
        `
        <div style="max-width: ${config.maxWidth}; margin: 0 auto; background-color: ${config.backgroundColor}; padding: 30px; font-family: ${config.fontFamily}; line-height: 1.6;">
          ${createHeading({
            text: 'Dear Adviser,',
            level: 2,
            customStyles: { color: config.headingColor },
          })}
          ${createParagraph({
            text: `We've identified ${articleObjects.length} new banking events in Denmark. Below are some notable opportunities that deserve your attention:`,
            fontSize: 18,
            customStyles: { marginBottom: '20px' },
          })}
          ${eventList}
          ${createParagraph({
            text: '<b>Stay ahead</b> with our cutting-edge banking intelligence.',
            fontSize: 16,
            customStyles: { marginTop: '20px' },
          })}
          ${createParagraph({
            text: `We look forward to your feedback. Please don't hesitate to contact us for more information.`,
            fontSize: 14,
            customStyles: { marginTop: '30px', color: config.footerTextColor },
          })}
          ${createParagraph({
            text: 'Best Regards,<br>Denmark Banking Intelligence Team',
            fontSize: 14,
            customStyles: { marginTop: '10px', color: config.footerTextColor },
          })}
        </div>
        `,
      ],
    },
    placeholders: {},
    isHTML: true,
  };
};