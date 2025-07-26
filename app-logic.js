// app-logic.js (version 1.0)
import { connectDatabase, disconnectDatabase } from './src/database.js';
import { scrapeAllHeadlines, scrapeArticleContent } from './src/modules/scraper/index.js';
import { filterFreshArticles, storeInitialHeadlineData, updateArticlesWithFullData } from './src/modules/mongoStore/index.js';
import { assessHeadlinesInBatches, assessArticleContent, performKimiSanityCheck, checkModelPermissions } from './src/modules/ai/index.js';
import { logger } from './src/utils/logger.js';
import { HEADLINES_RELEVANCE_THRESHOLD, LLM_MODEL_HEADLINES, LLM_MODEL_ARTICLES } from './src/config/index.js';
import { sendWealthEventsEmail, sendSupervisorReportEmail } from './src/modules/email/index.js';
import { truncateString } from './src/utils/helpers.js';

export async function runPipeline() {
    const runStartTime = Date.now();
    logger.info('🚀 STARTING HEADLINES PROCESSING PIPELINE...');
    const runStats = {
        headlinesScraped: 0,
        freshHeadlinesFound: 0,
        headlinesAssessed: 0,
        headlinesRelevant: 0,
        articlesForEnrichment: 0,
        articlesEnriched: 0,
        articlesAssessed: 0,
        articlesRelevant: 0,
        articlesEmailed: 0,
        errors: [],
    };

    let allProcessedArticles = [];
    let dbConnected = false;

    try {
        if (!await performKimiSanityCheck()) {
            logger.fatal('Kimi AI service failed the sanity check. Aborting pipeline.');
            return;
        }
        logger.info('✅ Kimi AI service passed sanity check.');

        const requiredModels = [LLM_MODEL_HEADLINES, LLM_MODEL_ARTICLES];
        if (!await checkModelPermissions(requiredModels)) {
            logger.fatal('Configured models not available via Kimi API. Aborting pipeline.');
            return;
        }
        logger.info('✅ Kimi model permissions verified.');

        await connectDatabase();
        dbConnected = true;

        const scrapedHeadlines = await scrapeAllHeadlines();
        runStats.headlinesScraped = scrapedHeadlines.length;
        if (scrapedHeadlines.length === 0) {
            logger.warn('No headlines scraped. Ending run.');
            return;
        }

        const freshHeadlines = await filterFreshArticles(scrapedHeadlines);
        runStats.freshHeadlinesFound = freshHeadlines.length;
        if (freshHeadlines.length === 0) {
            logger.info('No new headlines found. Ending run.');
            return;
        }
        logger.info(`Found ${freshHeadlines.length} new headlines to process.`);

        const assessedHeadlines = await assessHeadlinesInBatches(freshHeadlines);
        runStats.headlinesAssessed = assessedHeadlines.length;
        
        const relevantResults = assessedHeadlines
            .filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD)
            .sort((a, b) => b.relevance_headline - a.relevance_headline);

        logger.info(`📊 Headline Assessment Complete. Found ${relevantResults.length} relevant headlines.`);
        if (relevantResults.length > 0) {
            logger.info('--- Top 5 Relevant Headlines ---');
            relevantResults.slice(0, 5).forEach((article, i) => {
                logger.info(`${i + 1}. [Score: ${article.relevance_headline}] "${truncateString(article.headline, 70)}" - ${truncateString(article.assessment_headline, 50)}`);
            });
            logger.info('---------------------------------');
        }

        allProcessedArticles = await storeInitialHeadlineData(assessedHeadlines);
        logger.info('Stored initial data for all new headlines.');

        const relevantHeadlines = allProcessedArticles.filter(
            (article) => article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD && !article.storage_error_initial_headline_data
        );
        runStats.headlinesRelevant = relevantHeadlines.length;
        if (relevantHeadlines.length === 0) {
            logger.info('No new headlines met the relevance threshold for full article analysis.');
            return;
        }
        logger.info(`Found ${relevantHeadlines.length} relevant headlines for full article enrichment.`);
        runStats.articlesForEnrichment = relevantHeadlines.length;

        const enrichmentPromises = relevantHeadlines.map(async (article) => {
            const enrichedArticle = await scrapeArticleContent(article);
            if (enrichedArticle.articleContent && enrichedArticle.articleContent.contents.join('').length > 150) {
                runStats.articlesEnriched++;
                const finalAssessment = await assessArticleContent(enrichedArticle);
                return finalAssessment;
            }
            logger.warn(`Insufficient content for article: ${article.link}. Skipping full assessment.`);
            return { ...enrichedArticle, error: 'Insufficient content' };
        });

        const articlesToAssess = await Promise.all(enrichmentPromises);
        runStats.articlesAssessed = articlesToAssess.length;
        logger.info(`Assessed ${runStats.articlesAssessed} full articles.`);


        if (articlesToAssess.length > 0) {
            const fullyProcessedArticles = await updateArticlesWithFullData(articlesToAssess);

            allProcessedArticles = allProcessedArticles.map(proc => {
                const updated = fullyProcessedArticles.find(f => f.link === proc.link);
                return updated ? { ...proc, ...updated } : proc;
            });

            const finalEmailedArticles = await sendWealthEventsEmail(allProcessedArticles);
            runStats.articlesEmailed = finalEmailedArticles.filter(a => a.emailed).length;
            
            allProcessedArticles = finalEmailedArticles;
        }

    } catch (error) {
        logger.fatal({ err: error }, 'A critical error occurred in the main pipeline');
        runStats.errors.push(`CRITICAL: ${error.message}`);
    } finally {
        const runEndTime = Date.now();
        const duration = ((runEndTime - runStartTime) / 1000).toFixed(2);
        
        if (dbConnected) {
             logger.info(runStats, '📊 PIPELINE RUN SUMMARY');
             await sendSupervisorReportEmail(allProcessedArticles, runStats);
             await disconnectDatabase();
        } else {
             logger.info('Pipeline halted before DB connection. No supervisor report sent.');
        }
       
        logger.info(`✅ PIPELINE FINISHED in ${duration} seconds.`);
    }
}