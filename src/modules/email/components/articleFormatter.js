// File: headlines_mongo/src/modules/email/components/articleFormatter.js
import { createArticleCardForEmail } from '@daitanjs/html';
import { getLogger } from '@daitanjs/development';
import { EMAIL_CONFIG } from '../../../config/index.js';
import { truncateString } from '@daitanjs/utilities'; // Only for local summary construction logic

const logger = getLogger('headlines-mongo-email-articleformatter');

export function formatArticleForEmail(article, appEmailConfig = EMAIL_CONFIG) {
  if (
    !article ||
    typeof article !== 'object' ||
    !article.link ||
    !article.headline
  ) {
    logger.warn(
      `formatArticleForEmail: Invalid article object or missing link/headline. Skipping formatting.`,
      {
        articlePreview: article
          ? { headline: article.headline, link: article.link }
          : article,
      }
    );
    return `<p style="color:red; border:1px dashed red; padding:10px;">Error: Article data was invalid for email formatting.</p>`;
  }

  const genericArticleData = {
    link: article.link,
    headline: article.headline,
    source: article.source || article.newspaper || 'N/A',
    summary: 'No direct summary field, using assessment or content.',
    imageUrl: article.image || article.raw?.image || null, // Check raw.image too
    imageAlt: article.headline,
    assessmentText:
      article.assessment_article ||
      article.assessment_headline ||
      'Assessment not available.',
    relevanceScore:
      article.relevance_article !== undefined &&
      article.relevance_article !== null
        ? article.relevance_article
        : article.relevance_headline !== undefined &&
          article.relevance_headline !== null
        ? article.relevance_headline
        : 'N/A',
    callToActionText: 'Read Full Article Online →',
  };

  if (article.articleContent && typeof article.articleContent === 'object') {
    const ac = article.articleContent;
    if (
      ac.subheadings &&
      Array.isArray(ac.subheadings) &&
      ac.subheadings.length > 0 &&
      String(ac.subheadings[0] || '').trim()
    ) {
      genericArticleData.summary = truncateString(
        String(ac.subheadings[0]),
        250
      );
    } else if (
      ac.headlines &&
      Array.isArray(ac.headlines) &&
      ac.headlines.length > 0 &&
      String(ac.headlines[0] || '').trim() &&
      ac.headlines[0] !== article.headline
    ) {
      genericArticleData.summary = truncateString(String(ac.headlines[0]), 250);
    } else if (
      ac.contents &&
      Array.isArray(ac.contents) &&
      ac.contents.length > 0 &&
      String(ac.contents[0] || '').trim()
    ) {
      genericArticleData.summary = truncateString(String(ac.contents[0]), 250);
    } else if (
      genericArticleData.assessmentText &&
      genericArticleData.assessmentText !== 'Assessment not available.'
    ) {
      genericArticleData.summary = truncateString(
        genericArticleData.assessmentText,
        250
      );
    }
  }
  if (
    genericArticleData.summary ===
    'No direct summary field, using assessment or content.'
  ) {
    genericArticleData.summary = 'Detailed content available via link.';
  }

  logger.debug(
    `Formatting article for email: "${genericArticleData.headline}" using @daitanjs/html component.`
  );

  try {
    return createArticleCardForEmail({
      article: genericArticleData,
      config: appEmailConfig,
    });
  } catch (error) {
    logger.error(
      `❌ Error using createArticleCardForEmail from @daitanjs/html for article: "${article.headline}"`,
      {
        errorMessage: error.message,
        stack: error.stack?.substring(0, 500),
        articleData: article,
      }
    );
    return `<p style="color:red; border:1px dashed red; padding:10px;">Error formatting article "${truncateString(
      String(article.headline || 'Unknown Title'),
      50
    )}". Please check logs.</p>`;
  }
}
