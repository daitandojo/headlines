// src/pipeline/4_clusterAndSynthesize.js (version 2.0)
import { logger } from '../utils/logger.js';
import { clusterArticlesIntoEvents, synthesizeEvent, extractEntities } from '../modules/ai/eventProcessing.js';
import { findSimilarArticles } from '../modules/ai/rag.js';
import SynthesizedEvent from '../../models/SynthesizedEvent.js';
import { fetchWikipediaSummary } from '../utils/wikipedia.js';
import { truncateString } from '../utils/helpers.js';

export async function runClusterAndSynthesize(pipelinePayload) {
    logger.info('--- STAGE 4: CLUSTER & SYNTHESIZE ---');
    const { enrichedArticles, fullArticleMap, runStats, synthesizedEventsToSave = [] } = pipelinePayload;

    if (!enrichedArticles || enrichedArticles.length === 0) {
        logger.info("No relevant articles were enriched, skipping cluster and synthesis stage.");
        pipelinePayload.synthesizedEventsToSave = synthesizedEventsToSave;
        return { success: true, payload: pipelinePayload };
    }

    const articlesForClustering = enrichedArticles.map(a => ({
        _id: a._id.toString(),
        headline: a.headline,
        source: a.newspaper,
        summary: a.topic || a.assessment_article,
    }));

    const eventClusters = await clusterArticlesIntoEvents(articlesForClustering);
    runStats.eventsClustered = eventClusters.length;

    if (eventClusters.length === 0) {
        logger.info('No unique events were clustered from the relevant articles.');
        pipelinePayload.synthesizedEventsToSave = synthesizedEventsToSave;
        return { success: false, payload: pipelinePayload };
    }
    logger.info(`Clustered ${enrichedArticles.length} articles into ${eventClusters.length} unique events.`);
    
    for (const [index, cluster] of eventClusters.entries()) {
        const articlesInCluster = cluster.article_ids.map(id => fullArticleMap.get(id)).filter(Boolean);
        if (articlesInCluster.length === 0) continue;

        const primaryHeadline = articlesInCluster[0]?.headline || cluster.event_key;
        logger.info(`\n--- [ Synthesizing Event ${index + 1} of ${eventClusters.length}: "${truncateString(primaryHeadline, 70)}" ] ---`);

        const uniqueArticlesInCluster = Array.from(new Map(articlesInCluster.map(a => [a.link, a])).values());
        
        // **CONSOLIDATED LOGIC**: Entity extraction and Wikipedia lookups now happen here, once per event.
        const combinedTextForEntityExtraction = uniqueArticlesInCluster.map(a => {
            const contentSnippet = (a.articleContent?.contents || []).join(' ').substring(0, 1500);
            return `${a.headline}\n${a.assessment_article}\n${contentSnippet}`;
        }).join('\n\n');
        
        const entities = await extractEntities(combinedTextForEntityExtraction);

        let wikipediaContext = 'Not available.';
        if (entities.length > 0) {
            logger.info(`[Query Planner Agent] Decided to query Wikipedia for: [${entities.join(', ')}]`);
            const wikiPromises = entities.map(e => fetchWikipediaSummary(e));
            const wikiResults = await Promise.all(wikiPromises);
            const summaries = wikiResults.filter(r => r.success).map(r => r.summary);
            if (summaries.length > 0) {
                wikipediaContext = summaries.join('\n---\n');
            } else {
                logger.warn("Query Planner identified entities, but no Wikipedia summaries could be fetched.");
            }
        } else {
             logger.info("Query Planner Agent found no high-value entities for Wikipedia lookup.");
        }

        const historicalContext = await findSimilarArticles(uniqueArticlesInCluster);

        const payloadForLogging = {
            todays_articles: uniqueArticlesInCluster.map(a => ({
                headline: a.headline,
                content_snippet: `${(a.articleContent?.contents?.join(' ') || '[NO CONTENT]').substring(0, 100)}...`
            })),
            historical_articles_found: historicalContext.length,
            wikipedia_context_chars: wikipediaContext.length,
        };
        logger.info(payloadForLogging, 'Preparing payload for Synthesis Agent...');

        const synthesizedData = await synthesizeEvent(uniqueArticlesInCluster, historicalContext, wikipediaContext);

        if (synthesizedData && !synthesizedData.error) {
            runStats.eventsSynthesized++;
            const highestScoringArticle = uniqueArticlesInCluster.reduce((max, current) => (current.relevance_article > max.relevance_article) ? current : max, uniqueArticlesInCluster[0]);
            
            const eventToSave = new SynthesizedEvent({
                event_key: cluster.event_key,
                synthesized_headline: synthesizedData.headline,
                synthesized_summary: synthesizedData.summary,
                ai_assessment_reason: highestScoringArticle.assessment_article || highestScoringArticle.assessment_headline,
                country: highestScoringArticle.country,
                highest_relevance_score: Math.max(...uniqueArticlesInCluster.map(a => a.relevance_article)),
                key_individuals: synthesizedData.key_individuals || [],
                source_articles: uniqueArticlesInCluster.map(a => ({ headline: a.headline, link: a.link, newspaper: a.newspaper })),
            });
            synthesizedEventsToSave.push(eventToSave);
            runStats.synthesizedEventsForReport.push({ synthesized_headline: eventToSave.synthesized_headline, highest_relevance_score: eventToSave.highest_relevance_score });
        }
    }
    
    pipelinePayload.synthesizedEventsToSave = synthesizedEventsToSave;

    return { success: true, payload: pipelinePayload };
}