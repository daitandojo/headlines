// app-logic.js (version 2.0)
import mongoose from 'mongoose';
import { connectDatabase } from './src/database.js';
import { scrapeAllHeadlines, scrapeArticleContent } from './src/modules/scraper/index.js';
import { filterFreshArticles, savePipelineResults } from './src/modules/mongoStore/index.js';
import { assessHeadlinesInBatches, assessArticleContent, performAiSanityCheck, checkModelPermissions } from './src/modules/ai/index.js';
import { clusterArticlesIntoEvents, synthesizeEvent } from './src/modules/ai/eventProcessing.js';
import { findSimilarArticles } from './src/modules/ai/rag.js';
import SynthesizedEvent from './models/SynthesizedEvent.js';
import { logger } from './src/utils/logger.js';
import { logFinalReport } from './src/utils/pipelineLogger.js'; 
import { ARTICLES_RELEVANCE_THRESHOLD, HEADLINES_RELEVANCE_THRESHOLD, LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES } from './src/config/index.js';
import { sendWealthEventsEmail, sendSupervisorReportEmail } from './src/modules/email/index.js';
import { generateEmbedding } from './src/utils/vectorUtils.js';

export async function runPipeline(isRefreshMode = false) {
    const runStartTime = Date.now();
    logger.info('🚀 STARTING SYNTHESIS PIPELINE (Transactional Mode)...');
    const runStats = {
        headlinesScraped: 0,
        scraperHealth: [],
        freshHeadlinesFound: 0,
        headlinesAssessed: 0,
        relevantHeadlines: 0,
        enrichmentOutcomes: [],
        articlesEnriched: 0,
        relevantArticles: 0, 
        enrichedBySource: {},
        eventsClustered: 0,
        eventsSynthesized: 0,
        synthesizedEventsForReport: [], 
        eventsEmailed: 0,
        errors: [],
    };

    let dbConnected = false;
    let assessedCandidates = []; // Hold all processed articles here
    let synthesizedEventsToSave = []; // Hold all synthesized events

    try {
        // --- STEP 1: PRE-FLIGHT CHECKS & DB CONNECTION ---
        const requiredModels = [...new Set([LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES])];
        if (!await performAiSanityCheck() || !await checkModelPermissions(requiredModels)) {
            logger.fatal('AI service checks failed. Aborting pipeline.');
            return;
        }
        await connectDatabase();
        dbConnected = true;

        // --- STEP 2: SCRAPE & FILTER ARTICLES ---
        const { allArticles: scrapedHeadlines, scraperHealth } = await scrapeAllHeadlines();
        runStats.scraperHealth = scraperHealth;
        runStats.headlinesScraped = scrapedHeadlines.length;
        
        const articlesToProcess = await filterFreshArticles(scrapedHeadlines, isRefreshMode);
        runStats.freshHeadlinesFound = articlesToProcess.length;

        if (articlesToProcess.length === 0) {
            logger.info('No new or refreshed articles to process. Ending run.');
            return;
        }
        
        // --- STEP 3: PREPARE ARTICLES IN-MEMORY ---
        const articlesForPipeline = [];
        for (const article of articlesToProcess) {
            const embedding = await generateEmbedding(article.headline);
            articlesForPipeline.push({
                ...article,
                _id: new mongoose.Types.ObjectId(),
                embedding,
                relevance_headline: 0,
                assessment_headline: 'Awaiting assessment',
            });
        }
        
        // --- STEP 4: HEADLINE ASSESSMENT ---
        assessedCandidates = await assessHeadlinesInBatches(articlesForPipeline);
        runStats.headlinesAssessed = assessedCandidates.length;

        const relevantCandidates = assessedCandidates.filter(a => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD);
        runStats.relevantHeadlines = relevantCandidates.length;

        if (relevantCandidates.length === 0) {
            logger.info('No headlines met the relevance threshold for event synthesis.');
            // Go to 'finally' block to save the non-relevant headlines
            return; 
        }
        logger.info(`Found ${relevantCandidates.length} relevant headlines. Proceeding to enrichment...`);
        
        // --- STEP 5: ENRICHMENT & ARTICLE ASSESSMENT ---
        const enrichedArticles = [];
        for (const article of relevantCandidates) {
            const enriched = await scrapeArticleContent(article);
            
            if (enriched.articleContent && enriched.articleContent.contents.join('').length > 150) {
                const finalAssessment = await assessArticleContent(enriched);
                const contentSnippet = (finalAssessment.articleContent?.contents || []).join(' ').substring(0, 300);

                if (finalAssessment.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD) {
                    enrichedArticles.push(finalAssessment);
                    runStats.articlesEnriched++;
                    runStats.enrichedBySource[article.source] = (runStats.enrichedBySource[article.source] || 0) + 1;
                    runStats.enrichmentOutcomes.push({
                        headline: article.headline, link: article.link, newspaper: article.newspaper, outcome: 'Success',
                        headlineScore: article.relevance_headline, assessment_headline: article.assessment_headline,
                        finalScore: finalAssessment.relevance_article, assessment_article: finalAssessment.assessment_article,
                        content_snippet: contentSnippet,
                    });
                } else {
                    runStats.enrichmentOutcomes.push({
                        headline: article.headline, link: article.link, newspaper: article.newspaper, outcome: 'Dropped',
                        headlineScore: article.relevance_headline, assessment_headline: article.assessment_headline,
                        finalScore: finalAssessment.relevance_article, assessment_article: `Score was below threshold [${ARTICLES_RELEVANCE_THRESHOLD}]. AI Reason: ${finalAssessment.assessment_article}`,
                        content_snippet: contentSnippet,
                    });
                }
            } else {
                runStats.enrichmentOutcomes.push({
                    headline: article.headline, link: article.link, newspaper: article.newspaper, outcome: 'Dropped',
                    headlineScore: article.relevance_headline, assessment_headline: article.assessment_headline,
                    finalScore: null, assessment_article: `Enrichment Failed. Reason: ${enriched.enrichment_error || 'Scraped content was too short (< 150 chars)'}`,
                    content_snippet: 'Could not retrieve article content.',
                });
            }
        }
        runStats.relevantArticles = enrichedArticles.length;
        logger.info(`Enriched and assessed ${enrichedArticles.length} full articles meeting the relevance threshold.`);

        if (enrichedArticles.length === 0) {
            logger.info('No articles met the full article relevance threshold for event synthesis.');
            return;
        }

        // --- STEP 6: CLUSTERING & SYNTHESIS ---
        const eventClusters = await clusterArticlesIntoEvents(enrichedArticles);
        runStats.eventsClustered = eventClusters.length;
        if (eventClusters.length === 0) {
            logger.info('No unique events were clustered from the relevant articles.');
            return;
        }
        logger.info(`Clustered ${enrichedArticles.length} articles into ${eventClusters.length} unique events.`);

        for (const cluster of eventClusters) {
            const articlesInCluster = enrichedArticles.filter(a => cluster.article_ids.includes(a._id.toString()));
            if (articlesInCluster.length === 0) continue;

            const historicalContext = await findSimilarArticles(articlesInCluster);
            const synthesizedEvent = await synthesizeEvent(articlesInCluster, historicalContext);

            if (synthesizedEvent && !synthesizedEvent.error) {
                runStats.eventsSynthesized++;
                const highestScoringArticle = articlesInCluster.reduce((max, current) => (current.relevance_article > max.relevance_article) ? current : max, articlesInCluster[0]);
                const aggregatedIndividuals = articlesInCluster.flatMap(a => a.key_individuals || []);
                const uniqueIndividuals = Array.from(new Map(aggregatedIndividuals.map(p => [p.name, p])).values());

                const eventToSave = new SynthesizedEvent({
                    event_key: cluster.event_key,
                    synthesized_headline: synthesizedEvent.headline,
                    synthesized_summary: synthesizedEvent.summary,
                    ai_assessment_reason: highestScoringArticle.assessment_article || highestScoringArticle.assessment_headline,
                    highest_relevance_score: Math.max(...articlesInCluster.map(a => a.relevance_article)),
                    key_individuals: uniqueIndividuals,
                    source_articles: articlesInCluster.map(a => ({ headline: a.headline, link: a.link, newspaper: a.newspaper })),
                });
                synthesizedEventsToSave.push(eventToSave);
                runStats.synthesizedEventsForReport.push({ synthesized_headline: eventToSave.synthesized_headline, highest_relevance_score: eventToSave.highest_relevance_score });
            }
        }
        
    } catch (error) {
        logger.fatal({ err: error }, 'A critical error occurred in the main pipeline. No data will be committed.');
        runStats.errors.push(`CRITICAL: ${error.message}`);
        // Clear the arrays to prevent partial data save in 'finally' block
        assessedCandidates = [];
        synthesizedEventsToSave = [];
    } finally {
        // --- FINAL STEP: COMMIT & REPORT ---
        const runEndTime = Date.now();
        const duration = ((runEndTime / 1000) - (runStartTime / 1000)).toFixed(2);
        
        if (dbConnected && runStats.errors.length === 0) {
            // Only commit if the pipeline ran without critical errors.
            // The list of articles to save is now `assessedCandidates`, which includes ALL fresh articles from this run.
            if (assessedCandidates.length > 0) {
                const success = await savePipelineResults(assessedCandidates, synthesizedEventsToSave);
                if (success) {
                    logger.info(`Successfully committed ${assessedCandidates.length} articles and ${synthesizedEventsToSave.length} events to the database.`);
                    // Now that data is saved, trigger email.
                    const emailResult = await sendWealthEventsEmail();
                    runStats.eventsEmailed = emailResult.eventsSentCount;
                } else {
                     runStats.errors.push("CRITICAL: Failed to commit pipeline results to the database.");
                }
            }
            await sendSupervisorReportEmail(runStats);
        } else if (dbConnected) {
            // If there were errors, still send a supervisor report but don't commit data.
            await sendSupervisorReportEmail(runStats);
        } else {
             logger.warn('Pipeline halted before DB connection. No supervisor report or final stats will be generated.');
        }
       
        await logFinalReport(runStats, duration);
    }
}