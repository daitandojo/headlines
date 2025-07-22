// scripts/mail.js
import {
  getLogger,
  loadEnvironmentFiles,
  getEnvVariable,
} from '@daitanjs/development';
import {
  connectToMongoose,
  disconnectFromMongoose,
  getMongooseDefaultReadyState,
} from '@daitanjs/data';

// Initialize logger
const scriptLogger = getLogger('mailRelevantHeadlinesScript');

// --- Environment and DB Connection ---
async function initializeAndConnect() {
  scriptLogger.info('Initializing script environment...');
  loadEnvironmentFiles({ loggerInstance: scriptLogger, override: true });

  const MONGO_URI = getEnvVariable(
    'MONGO_URI',
    null,
    true,
    'string',
    'MongoDB Connection URI is required for this script.'
  );

  if (getMongooseDefaultReadyState() !== 1) {
    scriptLogger.info(`Attempting to connect to MongoDB...`);
    await connectToMongoose(MONGO_URI, {}, { loggerInstance: scriptLogger });
  }
}

async function disconnectDB() {
  if (getMongooseDefaultReadyState() !== 0) {
    await disconnectFromMongoose({ loggerInstance: scriptLogger });
  }
}

async function fetchAndEmailRelevantHeadlines() {
  let emailSentSuccessfully = false;
  let exitCode = 0;

  try {
    await initializeAndConnect();

    // Dynamically import modules that might depend on the environment
    const Article = (await import('../models/Article.js')).default;
    const { sendWealthEventsEmail } = await import(
      '../src/modules/email/index.js'
    );

    scriptLogger.info('Fetching relevant articles for emailing...');
    // Fetch articles that are likely candidates for emailing.
    // The actual filtering logic is inside sendWealthEventsEmail.
    const candidateArticles = await Article.find({
      $or: [
        { relevance_article: { $gte: 30 } },
        { relevance_headline: { $gte: 30 } },
      ],
      emailed: { $ne: true }, // Optional: avoid re-evaluating already emailed articles
    })
      .sort({ relevance_article: -1, relevance_headline: -1, createdAt: -1 })
      .limit(50) // Limit the number of candidates to process in one run
      .select(
        'headline link newspaper source topic articleContent assessment_article relevance_article assessment_headline relevance_headline amount contacts background image createdAt updatedAt error enrichment_error emailed email_error email_skipped_reason'
      )
      .lean();

    if (candidateArticles.length === 0) {
      scriptLogger.info(
        'No potential articles found meeting initial criteria. No email will be sent.'
      );
      return;
    }

    scriptLogger.info(
      `Found ${candidateArticles.length} candidate articles. Passing to email module for final filtering and sending.`
    );

    const emailProcessingResults = await sendWealthEventsEmail(
      candidateArticles
    );
    const successfullyEmailedCount = emailProcessingResults.filter(
      (article) => article && article.emailed
    ).length;

    if (successfullyEmailedCount > 0) {
      scriptLogger.info(
        `✅ App mailer module reported that ${successfullyEmailedCount} articles were included in the email.`
      );
      emailSentSuccessfully = true;
    } else {
      scriptLogger.warn(
        '⚠️ App mailer module did not send an email for any of the candidate articles.'
      );
    }
  } catch (error) {
    scriptLogger.error(
      'An error occurred during the mail script execution:',
      error
    );
    exitCode = 1;
  } finally {
    await disconnectDB();
    scriptLogger.info(
      `Mail script finished. Email process was ${
        emailSentSuccessfully ? 'successful' : 'not completed or skipped'
      }.`
    );
    setTimeout(() => process.exit(exitCode), 500);
  }
}

fetchAndEmailRelevantHeadlines();
