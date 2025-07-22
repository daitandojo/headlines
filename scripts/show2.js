// scripts/show.js

// DaitanJS imports
import {
  getLogger,
  initializeEnvironment
} from '@daitanjs/development';
import {
  connectToMongoose,
  disconnectFromMongoose,
  getMongooseDefaultReadyState,
  findWithModel,
  getMongooseInstance,
} from '@daitanjs/data';

const logger = getLogger('showRelevantScript');
const mongooseInstanceFromLib = getMongooseInstance();

mongooseInstanceFromLib.set('bufferTimeoutMS', 30000);

logger.info(
  'Global mongoose.bufferTimeoutMS set to 30000ms for this script run (using library instance).'
);

async function showRelevantHeadlines() {
  try {
    await initializeEnvironment();

    const MONGO_URI = getEnvVariable(
      'MONGO_URI',
      null,
      true,
      'string',
      'MongoDB Connection URI for script'
    );

    const Article = (await import('../models/Article.js')).default;

    await connectToMongoose(
      mongoUriFromEnv,
      {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 20000,
        socketTimeoutMS: 60000,
        bufferTimeoutMS: 30000,
      },
      { loggerInstance: logger }
    );

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
    process.exitCode = 1;
  } finally {
    await disconnectFromMongoose({ loggerInstance: logger });
    logger.info('Script finished.');
    // Let Node.js exit naturally or ensure it exits if there are hanging resources from libraries
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
}

showRelevantHeadlines();
