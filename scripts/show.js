// scripts/show.js
import {
  getLogger,
  loadEnvironmentFiles,
  getEnvVariable,
} from '@daitanjs/development';
import {
  connectToMongoose,
  disconnectFromMongoose,
  findWithModel,
} from '@daitanjs/data';

const logger = getLogger('showRelevantScript');

/**
 * Main function to connect to the database, fetch relevant articles,
 * display them, and then disconnect.
 */
async function showRelevantHeadlines() {
  let exitCode = 0;

  try {
    // 1. Initialize Environment by loading .env files
    logger.info('Initializing script environment...');
    loadEnvironmentFiles({ loggerInstance: logger, override: true });

    // 2. Get the required MONGO_URI from the now-populated process.env
    const MONGO_URI = getEnvVariable(
      'MONGO_URI',
      null, // No default, it's required
      true, // isRequired = true
      'string',
      'MongoDB Connection URI for this script'
    );

    // 3. Connect to the database using the DaitanJS data library
    await connectToMongoose(MONGO_URI, {}, { loggerInstance: logger });

    // 4. Dynamically import the model to ensure it uses the established connection
    const Article = (await import('../models/Article.js')).default;

    // 5. Fetch the data using the DaitanJS data utility
    logger.info('Fetching articles with relevance_headline > 0...');
    const relevantArticles = await findWithModel(
      Article,
      { relevance_headline: { $gt: 0 } },
      {
        select:
          'headline link relevance_headline assessment_headline newspaper source createdAt updatedAt',
        sort: { relevance_headline: -1, updatedAt: -1 },
        lean: true,
        loggerInstance: logger,
      }
    );

    // 6. Display the results in the console
    if (!relevantArticles || relevantArticles.length === 0) {
      logger.info('No articles found with relevance_headline > 0.');
    } else {
      console.log(
        `\nFound ${relevantArticles.length} articles with relevance_headline > 0:\n`
      );
      console.log(
        '===================================================================================='
      );
      relevantArticles.forEach((article, index) => {
        console.log(`Article #${index + 1}:`);
        console.log(`  Headline: ${article.headline}`);
        console.log(`  Link: ${article.link}`);
        console.log(
          `  Source: ${article.newspaper || article.source || 'N/A'}`
        );
        console.log(`  Headline Relevance: ${article.relevance_headline}`);
        console.log(`  Headline Assessment: ${article.assessment_headline}`);
        console.log(
          `  DB CreatedAt: ${
            article.createdAt
              ? new Date(article.createdAt).toLocaleString()
              : 'N/A'
          }`
        );
        console.log(
          `  DB UpdatedAt: ${
            article.updatedAt
              ? new Date(article.updatedAt).toLocaleString()
              : 'N/A'
          }`
        );
        console.log(
          '------------------------------------------------------------------------------------'
        );
      });
      console.log(
        '===================================================================================='
      );
    }
  } catch (error) {
    logger.error('An error occurred during script execution:', error);
    exitCode = 1;
  } finally {
    // 7. Ensure disconnection from the database
    await disconnectFromMongoose({ loggerInstance: logger });
    logger.info('Script finished.');
    setTimeout(() => process.exit(exitCode), 500); // Exit with appropriate code
  }
}

// Run the script
showRelevantHeadlines();
