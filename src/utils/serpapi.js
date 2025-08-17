// File: src/utils/serpapi.js

// src/utils/serpapi.js (version 3.0)
import { getJson } from 'serpapi'
import { SERPAPI_API_KEY } from '../config/index.js'
import { logger } from './logger.js'
import { truncateString } from './helpers.js'

if (!SERPAPI_API_KEY) {
  logger.warn(
    'SERPAPI_API_KEY not found in .env. The verification and enrichment agents will be disabled.'
  )
}

/**
 * Searches Google News for alternative articles based on a headline.
 * @param {string} headline - The headline to use as a search query.
 * @returns {Promise<{success: boolean, results: Array<{title: string, link: string, source: object | string}>}>}
 */
export async function findAlternativeSources(headline) {
  if (!SERPAPI_API_KEY) return { success: false, results: [] }
  try {
    const response = await getJson({
      engine: 'google_news',
      q: headline,
      api_key: SERPAPI_API_KEY,
    })
    if (response.error) {
      // --- FIX: If the error is just "no results", it's a warning, not a critical error.
      if (response.error.includes("Google News hasn't returned any results")) {
        logger.warn(
          `[SERPAPI] No Google News results found for query: "${truncateString(headline, 60)}"`
        )
        return { success: false, results: [] }
      }
      throw new Error(response.error)
    }
    if (response.news_results && response.news_results.length > 0) {
      return {
        success: true,
        results: response.news_results.map((res) => ({
          title: res.title,
          link: res.link,
          source: res.source,
        })),
      }
    }
    return { success: false, results: [] }
  } catch (error) {
    logger.error({ err: error }, 'A critical SERPAPI news search failed.')
    return { success: false, results: [] }
  }
}

/**
 * Performs a general Google search for contact enrichment research.
 * @param {string} query - The research query (e.g., "founders of Eliantie").
 * @returns {Promise<{success: boolean, snippets: string}>} A string of concatenated search result snippets.
 */
export async function performGoogleSearch(query) {
  if (!SERPAPI_API_KEY)
    return { success: false, snippets: 'SERPAPI_API_KEY not configured.' }
  try {
    logger.info(`[Research Agent] Executing Google search for: "${query}"`)
    const response = await getJson({
      engine: 'google',
      q: query,
      api_key: SERPAPI_API_KEY,
    })
    if (response.error) throw new Error(response.error)

    const organicResults = response.organic_results || []
    if (organicResults.length > 0) {
      const snippets = organicResults
        .slice(0, 5) // Use top 5 results
        .map((res) => `- ${res.title}: ${res.snippet}`)
        .join('\n')
      logger.info(
        `[Research Agent] Found ${organicResults.length} results. Synthesizing snippets for AI analysis.`
      )
      return { success: true, snippets }
    }
    logger.warn(`[Research Agent] No organic Google results found for query: "${query}"`)
    return { success: false, snippets: 'No search results found.' }
  } catch (error) {
    logger.error({ err: error }, 'SERPAPI general search failed.')
    return { success: false, snippets: `Search failed: ${error.message}` }
  }
}
