// File: src/pipeline/3_assessAndEnrich.js
import { logger } from '../utils/logger.js'
import {
  assessHeadlinesInBatches,
  assessArticleContent,
  extractKeyContacts,
  enrichContact,
  generateOpportunitiesFromArticle,
} from '../modules/ai/index.js'
import { synthesizeFromHeadline } from '../modules/ai/eventProcessing.js'
import { scrapeArticleContent } from '../modules/scraper/index.js'
import {
  ARTICLES_RELEVANCE_THRESHOLD,
  HEADLINES_RELEVANCE_THRESHOLD,
} from '../config/index.js'
import { findAlternativeSources } from '../utils/serpapi.js'

const HIGH_SIGNAL_THRESHOLD = 85
const SOURCE_BLACKLIST = ['twitter.com', 'facebook.com', 'linkedin.com']
const MIN_WEALTH_THRESHOLD_MM = 30
const VAGUE_NAME_STOP_WORDS = [
  'the sellers',
  'the founders',
  'shareholders',
  'the owners',
  'management team',
]

async function attemptVerificationAndEnrichment(article) {
  logger.info(
    `[Verification Agent] Triggered for high-signal headline (Score: ${article.relevance_headline}).`
  )
  const searchResult = await findAlternativeSources(article.headline)
  if (!searchResult.success || searchResult.results.length === 0) {
    logger.warn(`[Verification Agent] No alternative sources found.`)
    return null
  }
  for (const alternative of searchResult.results) {
    const sourceName =
      typeof alternative.source === 'object' && alternative.source.name
        ? alternative.source.name
        : alternative.source
    if (typeof sourceName !== 'string') continue
    const isBlacklisted = SOURCE_BLACKLIST.some((domain) =>
      alternative.link.includes(domain)
    )
    const isSameSource = article.newspaper && sourceName.includes(article.newspaper)
    if (isBlacklisted || isSameSource) continue
    const alternativeArticle = {
      ...article,
      link: alternative.link,
      newspaper: sourceName,
      source: sourceName,
    }
    const enrichedAlternative = await scrapeArticleContent(alternativeArticle)
    if (enrichedAlternative.articleContent) {
      logger.info(
        `[Verification Agent] SUCCESS! Scraped content from new source: ${sourceName}`
      )
      return enrichedAlternative
    }
  }
  logger.warn(
    `[Verification Agent] All filtered alternative sources failed to provide content.`
  )
  return null
}

// --- NEW, MORE ROBUST enrichment function for a single article ---
async function processSingleArticle(article, candidatesMap, runStats) {
  try {
    logger.info(`\n--- [ ENRICHING: "${article.headline}" ] ---`)
    let finalEnrichedArticle = await scrapeArticleContent(article)

    // Attempt verification if initial scrape fails for a high-signal headline
    if (
      !finalEnrichedArticle.articleContent &&
      article.relevance_headline >= HIGH_SIGNAL_THRESHOLD
    ) {
      const verifiedArticle = await attemptVerificationAndEnrichment(article)
      if (verifiedArticle) finalEnrichedArticle = verifiedArticle
    }

    if (finalEnrichedArticle.articleContent) {
      const finalAssessment = await assessArticleContent(finalEnrichedArticle)

      // Store the full assessment back into the central map
      const originalArticleToUpdate = candidatesMap.get(article._id.toString())
      if (originalArticleToUpdate) {
        Object.assign(originalArticleToUpdate, finalAssessment)
      }

      // If the article is relevant, proceed with deep enrichment (contacts, opportunities)
      if (finalAssessment.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD) {
        const initialContactData = await extractKeyContacts(finalAssessment)
        if (initialContactData.key_individuals.length > 0) {
          const enrichedContactPromises = initialContactData.key_individuals.map(
            (contact) => enrichContact(contact, finalAssessment)
          )
          const enrichedContactsArrays = await Promise.all(enrichedContactPromises)
          finalAssessment.key_individuals = enrichedContactsArrays.flat()
        }

        const rawOpportunities = await generateOpportunitiesFromArticle(finalAssessment)
        const validOpportunities = (rawOpportunities || []).filter((opp) => {
          const nameIsValid =
            opp.reachOutTo &&
            !VAGUE_NAME_STOP_WORDS.some((phrase) =>
              opp.reachOutTo.toLowerCase().includes(phrase)
            )
          const wealthIsValid = opp.likelyMMDollarWealth >= MIN_WEALTH_THRESHOLD_MM
          return nameIsValid && wealthIsValid
        })

        logger.info(
          `[Opportunity Agent] Generated ${rawOpportunities.length} raw opportunities, kept ${validOpportunities.length} after filtering.`
        )

        const opportunitiesWithSource = validOpportunities.map((opp) => ({
          ...opp,
          sourceArticleId: finalAssessment._id,
        }))

        runStats.articlesEnriched++
        return { article: finalAssessment, opportunities: opportunitiesWithSource }
      }
    } else {
      // Handle failed enrichment (salvage)
      logger.warn(`Enrichment failed for "${article.headline}". Attempting to salvage.`)
      const salvagedData = await synthesizeFromHeadline(article)
      if (salvagedData && salvagedData.headline) {
        const promotedArticle = {
          ...article,
          relevance_article: article.relevance_headline,
          assessment_article: salvagedData.summary,
          topic: salvagedData.headline,
          key_individuals: salvagedData.key_individuals || [],
          articleContent: { contents: [salvagedData.summary] },
        }
        logger.info(
          `Salvage successful. Promoting article "${promotedArticle.headline}" for clustering.`
        )
        Object.assign(candidatesMap.get(article._id.toString()), promotedArticle)

        runStats.articlesEnriched++
        return { article: promotedArticle, opportunities: [] }
      }
    }
  } catch (error) {
    logger.error(
      { err: error, article: article.headline },
      'A critical error occurred while processing a single article. Skipping it.'
    )
    // Return null to indicate failure for this article
    return null
  }
  // Return null if article was not relevant enough after content assessment
  return null
}

export async function runAssessAndEnrich(pipelinePayload) {
  logger.info('--- STAGE 3: ASSESS & ENRICH ---')
  const { articlesForPipeline, runStats } = pipelinePayload

  const assessedCandidates = await assessHeadlinesInBatches(articlesForPipeline)
  runStats.headlinesAssessed = assessedCandidates.length

  const candidatesMap = new Map(assessedCandidates.map((a) => [a._id.toString(), a]))
  const relevantCandidates = assessedCandidates.filter(
    (a) => a.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
  )
  runStats.relevantHeadlines = relevantCandidates.length

  if (relevantCandidates.length === 0) {
    logger.info('No headlines were relevant enough for full enrichment.')
    pipelinePayload.assessedCandidates = assessedCandidates
    return { success: false, payload: pipelinePayload }
  }

  // --- REWRITTEN FOR ROBUSTNESS: Process articles in parallel with Promise.allSettled ---
  const processingPromises = relevantCandidates.map((article) =>
    processSingleArticle(article, candidatesMap, runStats)
  )

  const results = await Promise.allSettled(processingPromises)

  const enrichedArticles = []
  const opportunitiesToSave = []

  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      // result.value is { article, opportunities }
      enrichedArticles.push(result.value.article)
      if (result.value.opportunities && result.value.opportunities.length > 0) {
        opportunitiesToSave.push(...result.value.opportunities)
      }
    } else if (result.status === 'rejected') {
      logger.error(
        { reason: result.reason },
        'A promise was rejected during article enrichment.'
      )
    }
  })
  // --- END REWRITE ---

  runStats.relevantArticles = enrichedArticles.length

  const fullArticleMap = new Map()
  enrichedArticles.forEach((article) => {
    fullArticleMap.set(article._id.toString(), article)
  })

  pipelinePayload.enrichedArticles = enrichedArticles
  pipelinePayload.fullArticleMap = fullArticleMap
  pipelinePayload.assessedCandidates = Array.from(candidatesMap.values())
  pipelinePayload.opportunitiesToSave = opportunitiesToSave

  const success = enrichedArticles.length > 0
  return { success, payload: pipelinePayload }
}
