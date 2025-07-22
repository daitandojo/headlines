// File: headlines_mongo/src/modules/email/components/supervisorEmailBodyBuilder.js
import {
  createEmailWrapper,
  createEmailHeader,
  createEmailFooter,
  createHeading,
  createParagraph,
  createTable,
  createLink,
  createList,
  createBlock,
} from '@daitanjs/html';
import { getLogger } from '@daitanjs/development';
import {
  SUPERVISOR_EMAIL_CONFIG,
  HEADLINES_RELEVANCE_THRESHOLD,
  ARTICLES_RELEVANCE_THRESHOLD,
} from '../../../config/index.js';
import { truncateString } from '@daitanjs/utilities';
import { LOGO_URL } from '../constants.js';

const logger = getLogger('headlines-mongo-supervisor-email');

function buildSupervisorErrorEmailBody(
  errorMessage,
  errorStack = 'N/A',
  config = SUPERVISOR_EMAIL_CONFIG
) {
  const runTimestamp = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/Copenhagen',
  });
  const escapeHtml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&') // This was incorrect, should be &
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, `'`);
  };
  const safeErrorMessage =
    escapeHtml(errorMessage) || 'Unknown error generating report.';
  const safeErrorStack = escapeHtml(errorStack) || 'No stack trace available.';

  const errorBodyContent = `
    ${createHeading({
      text: 'Supervisor Report Generation Error',
      level: 1,
      customStyles: { color: 'red', marginBottom: '15px' },
    })}
    ${createParagraph({
      text: `<strong>Run Timestamp:</strong> ${runTimestamp}`,
      customStyles: { marginBottom: '10px' },
    })}
    ${createParagraph({
      text: `An internal error occurred while generating the supervisor report:`,
      customStyles: { fontWeight: 'bold' },
    })}
    ${createParagraph({
      text: safeErrorMessage,
      customStyles: {
        color: 'red',
        border: '1px dashed red',
        padding: '10px',
        backgroundColor: '#ffeeee',
      },
    })}
    ${createHeading({
      text: 'Stack Trace:',
      level: 3,
      customStyles: { marginTop: '20px', marginBottom: '5px' },
    })}
    ${createBlock({
      content: `<pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${safeErrorStack}</pre>`,
      customStyles: {
        backgroundColor: '#f0f0f0',
        padding: '10px',
        border: '1px solid #ccc',
      },
    })}
    ${createParagraph({
      text: 'Please check the application logs for detailed diagnostics.',
      customStyles: { marginTop: '20px' },
    })}
  `;
  return createEmailWrapper({ bodyContent: errorBodyContent, config });
}

function getArticleStatusForReport(article) {
  if (!article || typeof article !== 'object') return 'Invalid Article Data';
  if (article.storage_error_initial_headline_data)
    return `Storage Error (Initial): ${truncateString(
      String(article.storage_error_initial_headline_data),
      40
    )}`;
  if (
    article.error &&
    article.error !== 'Insufficient content' &&
    !article.error.toLowerCase().includes('ai error')
  )
    return `Processing Error: ${truncateString(String(article.error), 40)}`;
  if (article.enrichment_error)
    return `Enrichment Error: ${truncateString(
      String(article.enrichment_error),
      40
    )}`;
  if (article.error && article.error.toLowerCase().includes('ai error'))
    return `AI Assessment Error: ${truncateString(String(article.error), 40)}`;
  if (article.error === 'Insufficient content')
    return `Insufficient content for full AI analysis`;
  const headlineRelevant =
    typeof article.relevance_headline === 'number' &&
    article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD;
  const articleRelevant =
    typeof article.relevance_article === 'number' &&
    article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD;
  if (articleRelevant) return 'Relevant (Full Article)';
  if (
    headlineRelevant &&
    (article.relevance_article === undefined ||
      article.relevance_article === null)
  )
    return 'Headline Relevant, Article Not Assessed';
  if (
    headlineRelevant &&
    typeof article.relevance_article === 'number' &&
    !articleRelevant
  )
    return 'Headline Relevant, Content Not Relevant';
  if (headlineRelevant) return 'Headline Relevant (Issue processing content)';
  if (typeof article.relevance_headline === 'number' && !headlineRelevant)
    return 'Low Headline Relevance';
  return 'Status Undetermined';
}

export function createSupervisorEmailBody(
  allProcessedArticlesInput,
  runStats,
  config = SUPERVISOR_EMAIL_CONFIG
) {
  const runTimestamp = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/Copenhagen',
  });
  const functionName = 'createSupervisorEmailBody';

  logger.info(
    `[${functionName}] Preparing supervisor report. Articles received: ${
      Array.isArray(allProcessedArticlesInput)
        ? allProcessedArticlesInput.length
        : 'Invalid input type'
    }.`
  );

  if (!Array.isArray(allProcessedArticlesInput)) {
    const errorMsg = `Internal error: Input data for supervisor report (allProcessedArticlesInput) was not an array. Type: ${typeof allProcessedArticlesInput}`;
    logger.error(`[${functionName}] CRITICAL: ${errorMsg}`, {
      dataPreview: String(allProcessedArticlesInput).substring(0, 200),
    });
    return buildSupervisorErrorEmailBody(
      errorMsg,
      'N/A - Input data structure error',
      config
    );
  }

  let statsHtml = createHeading({
    text: 'Run Statistics',
    level: 2,
    customStyles: {
      color: config.headingColor,
      marginBottom: '10px',
      textAlign: 'left',
    },
  });
  if (
    runStats &&
    typeof runStats === 'object' &&
    Object.keys(runStats).length > 0
  ) {
    const statsItems = Object.entries(runStats).map(
      ([key, value]) =>
        `<strong>${key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase())}:</strong> ${value}`
    );
    statsHtml += createList({
      items: statsItems,
      customStyles: {
        paddingLeft: '20px',
        marginBottom: '20px',
        fontSize: '12px',
      },
    });
  } else {
    statsHtml += createParagraph({
      text: 'No run statistics provided or stats object empty.',
      customStyles: { fontStyle: 'italic' },
    });
  }
  if (runStats?.pipelineError) {
    statsHtml += createParagraph({
      text: `<strong>Pipeline Error:</strong> <span style="color:red;">${runStats.pipelineError}</span>`,
    });
  } else if (runStats?.errorType) {
    statsHtml += createParagraph({
      text: `<strong>Error Type:</strong> <span style="color:red;">${runStats.errorType}</span>`,
    });
    statsHtml += createParagraph({
      text: `<strong>Error Message:</strong> <span style="color:red;">${runStats.errorMessage}</span>`,
    });
  }

  let articlesTableHtml = '';
  const validArticlesForTable = allProcessedArticlesInput.filter(
    (a) => a && typeof a === 'object' && ('headline' in a || 'link' in a)
  );

  if (validArticlesForTable.length > 0) {
    let sortedArticles;
    try {
      sortedArticles = [...validArticlesForTable].sort((a, b) => {
        const aIsError = !!(
          a.error ||
          a.enrichment_error ||
          a.storage_error_initial_headline_data ||
          a.db_error_reason
        );
        const bIsError = !!(
          b.error ||
          b.enrichment_error ||
          b.storage_error_initial_headline_data ||
          b.db_error_reason
        );
        if (aIsError && !bIsError) return 1;
        if (!aIsError && bIsError) return -1;

        const aScore =
          a.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD && !aIsError
            ? a.relevance_article + 1000
            : a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD && !aIsError
            ? a.relevance_headline + 500
            : a.relevance_headline || 0;
        const bScore =
          b.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD && !bIsError
            ? b.relevance_article + 1000
            : b.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD && !bIsError
            ? b.relevance_headline + 500
            : b.relevance_headline || 0;
        return (bScore || 0) - (aScore || 0);
      });
    } catch (sortError) {
      logger.error(
        `[${functionName}] CRITICAL: Error during article sort operation.`,
        { errorMessage: sortError.message }
      );
      return buildSupervisorErrorEmailBody(
        `Internal error during data sorting: ${sortError.message}`,
        sortError.stack,
        config
      );
    }

    const tableHeaders = [
      '#',
      'Headline (Link)',
      'Source',
      'HL Score',
      'HL Assess.',
      'Art. Score',
      'Art. Assess.',
      'Status/Error',
      'Emailed?',
    ];
    const tableRows = sortedArticles.map((article, index) => {
      const emojiHL =
        article.relevance_headline === undefined ||
        article.relevance_headline === null
          ? '❓'
          : article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
          ? '👍'
          : '👎';
      const emojiArt =
        article.relevance_article === undefined ||
        article.relevance_article === null
          ? '❓'
          : article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD
          ? '👍'
          : '👎';

      const hlScore = article.relevance_headline ?? 'N/A';
      const hlAssess =
        truncateString(String(article.assessment_headline ?? ''), 50) || 'N/A';
      const artScore = article.relevance_article ?? 'N/A';
      const artAssess =
        truncateString(String(article.assessment_article ?? ''), 50) || 'N/A';
      const statusText = getArticleStatusForReport(article);
      const emailedStatus = article.emailed
        ? 'Yes'
        : article.email_error
        ? `Error: ${truncateString(article.email_error, 20)}`
        : article.email_skipped_reason
        ? `Skipped: ${truncateString(article.email_skipped_reason, 20)}`
        : 'No';

      return [
        { text: String(index + 1) },
        {
          text: createLink({
            href: String(article.link ?? '#'),
            text: truncateString(String(article.headline ?? 'N/A'), 45),
            customStyles: { color: config.linkColor, fontSize: '11px' },
          }),
        },
        { text: truncateString(String(article.newspaper || article.source || 'N/A'), 15) },
        { text: `${emojiHL} ${String(hlScore)}` },
        { text: hlAssess },
        { text: `${emojiArt} ${String(artScore)}` },
        { text: artAssess },
        { text: truncateString(statusText, 60) },
        { text: emailedStatus },
      ];
    });

    articlesTableHtml = createHeading({
      text: 'Processed Headlines Details',
      level: 2,
      customStyles: {
        color: config.headingColor,
        marginTop: '20px',
        marginBottom: '10px',
        textAlign: 'left',
      },
    });
    articlesTableHtml += createTable({
      headers: tableHeaders,
      rows: tableRows,
      customStyles: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '10px',
        tableLayout: 'fixed',
      },
      headerCellStyles: {
        backgroundColor: config.tableHeaderBgColor,
        color: config.headingColor,
        padding: config.tableCellPadding,
        border: `1px solid ${config.tableBorderColor}`,
        textAlign: 'left',
        fontSize: '11px',
        fontWeight: 'bold',
      },
      bodyCellStyles: {
        padding: config.tableCellPadding,
        border: `1px solid ${config.tableBorderColor}`,
        textAlign: 'left',
        verticalAlign: 'top',
        wordBreak: 'break-word',
      },
    });
  } else if (runStats && !runStats.pipelineError && !runStats.errorType) {
    articlesTableHtml = createParagraph({
      text: 'No fresh headlines were assessed in this run, or no articles had enough data for reporting.',
      customStyles: { marginTop: '20px', fontStyle: 'italic' },
    });
  }

  const headerContent = createEmailHeader({
    logoUrl: LOGO_URL,
    logoAlt: `${config.brandName || 'System'} Logo`,
    customStyles: { textAlign: 'center', paddingBottom: '15px' },
  });

  const mainBody = `
    ${headerContent}
    ${createHeading({
      text: config.subject,
      level: 1,
      customStyles: {
        color: config.headingColor,
        textAlign: 'center',
        marginBottom: '5px',
        fontSize: '22px',
      },
    })}
    ${createParagraph({
      text: `Run completed: ${runTimestamp}`,
      customStyles: {
        textAlign: 'center',
        color: config.metaTextColor || '#777',
        fontSize: '12px',
        marginBottom: '25px',
      },
    })}
    ${statsHtml}
    ${articlesTableHtml}
  `;

  const footerContent = createEmailFooter({
    companyName: config.brandName || 'DaitanJS Systems',
    footerText: 'This is an automated report.',
    textStyles: {
      fontSize: '11px',
      color: config.footerTextColor || '#999999',
    },
    customStyles: { marginTop: '30px' },
  });

  const fullEmailContent = `
    ${mainBody}
    ${footerContent}
  `;

  try {
    return createEmailWrapper({ bodyContent: fullEmailContent, config });
  } catch (wrapperError) {
    logger.error(
      `[${functionName}] CRITICAL: Error using createEmailWrapper for supervisor report.`,
      { errorMessage: wrapperError.message }
    );
    return `<html><body><h1>Error in Email Wrapper</h1><p>${wrapperError.message}</p>${mainBody}${footerContent}</body></html>`;
  }
}