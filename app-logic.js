// app-logic.js
import { connectDatabase, disconnectDatabase } from './src/database.js';
import { scrapeAllHeadlines, scrapeArticleContent } from './src/modules/scraper/index.js';
import { filterFreshArticles, prepareArticlesForPipeline, updateArticlesWithFullData } from './src/modules/mongoStore/index.js';
import { assessHeadlinesInBatches, assessArticleContent, performKimiSanityCheck, checkModelPermissions } from './src/modules/ai/index.js';
import { clusterArticlesIntoEvents, synthesizeEvent } from './src/modules/ai/eventProcessing.js';
import { findSimilarArticles } from './src/modules/ai/rag.js';
import Article from './models/Article.js';
import SynthesizedEvent from './models/SynthesizedEvent.js';
import { logger } from './src/utils/logger.js';
import { HEADLINES_RELEVANCE_THRESHOLD, LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES } from './src/config/index.js';
import { sendWealthEventsEmail, sendSupervisorReportEmail } from './src/modules/email/index.js';
import { truncateString } from './src/utils/helpers.js';

export async function runPipeline() {
    const runStartTime = Date.now();
    logger.info('🚀 STARTING SYNTHESIS PIPELINE...');
    const runStats = {
        headlinesScraped: 0,
        scraperHealth: [],
        freshHeadlinesFound: 0,
        headlinesAssessed: 0,
        relevantHeadlines: 0,
        articlesEnriched: 0,
        enrichedBySource: {},
        eventsClustered: 0,
        eventsSynthesized: 0,
        eventsEmailed: 0,
        errors: [],
    };

    let dbConnected = false;

    try {
        // --- STEP 1: PRE-FLIGHT CHECKS & DB CONNECTION ---
        const requiredModels = [LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES];
        if (!await performKimiSanityCheck() || !await checkModelPermissions(requiredModels)) {
            logger.fatal('AI service checks failed. Aborting pipeline.');
            return;
        }
        await connectDatabase();
        dbConnected = true;

        // --- STEP 2: SCRAPE & PREPARE ARTICLES ---
        const { allArticles: scrapedHeadlines, scraperHealth } = await scrapeAllHeadlines();
        runStats.scraperHealth = scraperHealth;
        runStats.headlinesScraped = scrapedHeadlines.length;
        
        const articlesToProcess = await filterFreshArticles(scrapedHeadlines);
        runStats.freshHeadlinesFound = articlesToProcess.length;

        if (articlesToProcess.length === 0) {
            logger.info('No new or refreshed articles to process. Ending run.');
            return;
        }
        
        const articlesForPipeline = await prepareArticlesForPipeline(articlesToProcess);

        if (articlesForPipeline.length === 0) {
            logger.info('No articles were successfully prepared for the pipeline. Ending run.');
            return;
        }

        // --- STEP 3: HEADLINE ASSESSMENT ---
        const assessedCandidates = await assessHeadlinesInBatches(articlesForPipeline);
        runStats.headlinesAssessed = assessedCandidates.length;

        logger.info('--- Headline Assessment Complete ---');
        assessedCandidates.forEach(a => {
            const status = a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD ? '✅ Relevant' : '❌ Irrelevant';
            logger.info(`[${String(a.relevance_headline).padStart(3, ' ')}] ${status} - "${truncateString(a.headline, 70)}"`);
        });

        const relevantCandidates = assessedCandidates.filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD);
        runStats.relevantHeadlines = relevantCandidates.length;

        if (relevantCandidates.length === 0) {
            logger.info('No headlines met the relevance threshold for event synthesis.');
            return;
        }
        logger.info(`Found ${relevantCandidates.length} relevant headlines for enrichment.`);
        
        // --- STEP 4: ENRICHMENT & ARTICLE ASSESSMENT ---
        const enrichedArticles = [];
        for (const article of relevantCandidates) {
            const enriched = await scrapeArticleContent(article);
            if (enriched.articleContent && enriched.articleContent.contents.join('').length > 150) {
                const finalAssessment = await assessArticleContent(enriched);
                enrichedArticles.push(finalAssessment);
                runStats.articlesEnriched++;
                runStats.enrichedBySource[article.source] = (runStats.enrichedBySource[article.source] || 0) + 1;
            }
        }
        await updateArticlesWithFullData(enrichedArticles);
        logger.info(`Enriched and assessed ${enrichedArticles.length} full articles.`);

        // --- STEP 5: CLUSTERING ---
        const eventClusters = await clusterArticlesIntoEvents(enrichedArticles);
        runStats.eventsClustered = eventClusters.length;
        if (eventClusters.length === 0) {
            logger.info('No unique events were clustered from the relevant articles.');
            return;
        }
        logger.info(`Clustered ${enrichedArticles.length} articles into ${eventClusters.length} unique events.`);

        // --- STEP 6: SYNTHESIS ---
        const synthesizedEventsToSave = [];
        for (const cluster of eventClusters) {
            const articlesInCluster = enrichedArticles.filter(a => cluster.article_ids.includes(a._id.toString()));
            if (articlesInCluster.length === 0) continue;

            const historicalContext = await findSimilarArticles(articlesInCluster);
            const synthesizedEvent = await synthesizeEvent(articlesInCluster, historicalContext);

            if (synthesizedEvent && !synthesizedEvent.error) {
                runStats.eventsSynthesized++;
                logger.info(`Synthesized Event: "${truncateString(synthesizedEvent.headline, 80)}"`);
                const aggregatedIndividuals = articlesInCluster.flatMap(a => a.key_individuals || []);
                const uniqueIndividuals = Array.from(new Map(aggregatedIndividuals.map(p => [p.name, p])).values());

                const eventToSave = new SynthesizedEvent({
                    event_key: cluster.event_key,
                    synthesized_headline: synthesizedEvent.headline,
                    synthesized_summary: synthesizedEvent.summary,
                    highest_relevance_score: Math.max(...articlesInCluster.map(a => a.relevance_article || a.relevance_headline)),
                    key_individuals: uniqueIndividuals,
                    source_articles: articlesInCluster.map(a => ({
                        article_id: a._id,
                        headline: a.headline,
                        link: a.link,
                        newspaper: a.newspaper
                    })),
                });
                synthesizedEventsToSave.push(eventToSave);
            }
        }

        if (synthesizedEventsToSave.length > 0) {
            await SynthesizedEvent.updateMany(
                { event_key: { $in: synthesizedEventsToSave.map(e => e.event_key) } },
                { $set: { emailed: false } }
            );
            await SynthesizedEvent.bulkWrite(
                synthesizedEventsToSave.map(e => ({
                    updateOne: {
                        filter: { event_key: e.event_key },
                        update: { $set: e },
                        upsert: true,
                    }
                }))
            );
            logger.info(`Successfully saved/updated ${synthesizedEventsToSave.length} synthesized events.`);
        }
        
        // --- STEP 7: SEND EMAIL ---
        const emailResult = await sendWealthEventsEmail();
        runStats.eventsEmailed = emailResult.eventsSentCount;

    } catch (error) {
        logger.fatal({ err: error }, 'A critical error occurred in the main pipeline');
        runStats.errors.push(`CRITICAL: ${error.message}`);
    } finally {
        const runEndTime = Date.now();
        const duration = ((runEndTime - runStartTime) / 1000).toFixed(2);
        
        if (dbConnected) {
             await sendSupervisorReportEmail(runStats);
             await disconnectDatabase();
        } else {
             logger.info('Pipeline halted before DB connection. No supervisor report sent.');
        }
       
        logger.info(`PIPELINE FINISHED in ${duration} seconds. Emailed ${runStats.eventsEmailed} events.`);
    }
}