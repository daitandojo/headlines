// src/utils/wikipedia.js (version 3.1 - Hardened Disambiguation)
import { logger } from './logger.js';
import client from '../modules/ai/client.js'; // Use the central AI client
import { LLM_MODEL } from '../config/index.js';

const WIKI_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const WIKI_SUMMARY_LENGTH = 750;
const DISAMBIGUATION_MODEL = LLM_MODEL;

// --- REVISED: Hardened Domain-Constrained Disambiguation Prompt ---
const DISAMBIGUATION_PROMPT = `You are a Wikipedia search disambiguation agent for a wealth management firm. Your task is to find the most relevant Wikipedia page title from a list of search results that matches the "Original Query".

**CRITICAL Instructions:**
1.  Your focus is exclusively on **wealth management intelligence**.
2.  Analyze the "Original Query" to understand the user's intent, which will be a person, company, or financial entity.
3.  Review the "Search Results" and their snippets (descriptions).
4.  Choose the title that is the most direct and relevant match for an **individual, company, private equity firm, or major financial transaction.**
5.  You are FORBIDDEN from choosing a page if its snippet clearly indicates it is a **song, film, video game, fictional character, fashion brand, or generic concept.** For example, for the query "Chrome", you must not select "Chrome Hearts" (a fashion brand).
6.  If no result is a good match for a financial or corporate entity, you MUST respond with "null".

Respond ONLY with a valid JSON object: { "best_title": "The Most Relevant Page Title" | null }`;

/**
 * Uses a multi-step, AI-powered process to find the correct Wikipedia page and fetch its summary.
 * @param {string} query - The search term (e.g., a person or company name).
 * @returns {Promise<{success: boolean, summary?: string, error?: string}>}
 */
export async function fetchWikipediaSummary(query) {
    if (!query) return { success: false, error: "Query cannot be empty." };
    try {
        // Step 1: Search for potential pages
        const searchParams = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "5", format: "json" });
        logger.info(`Querying Wikipedia for: "${query}"`);
        const searchResponse = await fetch(`${WIKI_API_ENDPOINT}?${searchParams.toString()}`);
        if (!searchResponse.ok) throw new Error(`Search API returned status ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const searchResults = searchData.query.search;
        if (!searchResults || searchResults.length === 0) throw new Error(`No search results found for query "${query}".`);

        // Step 2: Use an AI agent to disambiguate
        const disambiguationResponse = await client.chat.completions.create({
            model: DISAMBIGUATION_MODEL,
            messages: [
                { role: 'system', content: DISAMBIGUATION_PROMPT },
                { role: 'user', content: `Original Query: "${query}"\n\nSearch Results:\n${JSON.stringify(searchResults.map(r => ({title: r.title, snippet: r.snippet})))}` }
            ],
            response_format: { type: 'json_object' },
        });
        const { best_title } = JSON.parse(disambiguationResponse.choices[0].message.content);
        
        if (!best_title) throw new Error(`AI agent could not disambiguate a relevant page for "${query}".`);
        
        const queryWords = new Set(query.toLowerCase().split(' '));
        const titleWords = new Set(best_title.toLowerCase().split(' '));
        const intersection = new Set([...queryWords].filter(word => titleWords.has(word)));
        if (intersection.size === 0) {
            throw new Error(`Rejected irrelevant AI choice: "${best_title}" has no overlap with original query "${query}".`);
        }

        logger.info(`[Disambiguation Agent] Chose best page title: "${best_title}"`);

        // Step 3: Fetch the summary for the verified page title
        const summaryParams = new URLSearchParams({ action: "query", prop: "extracts", exintro: "true", explaintext: "true", titles: best_title, format: "json", redirects: "1" });
        const summaryResponse = await fetch(`${WIKI_API_ENDPOINT}?${summaryParams.toString()}`);
        if (!summaryResponse.ok) throw new Error(`Summary API returned status ${summaryResponse.status}`);
        const summaryData = await summaryResponse.json();
        const pages = summaryData.query.pages;
        const pageId = Object.keys(pages)[0];
        if (!pages[pageId] || pages[pageId].missing) throw new Error(`Page "${best_title}" does not exist.`);
        const summary = pages[pageId].extract;
        if (!summary) throw new Error(`Could not extract summary for page "${best_title}".`);
        
        const conciseSummary = summary.length > WIKI_SUMMARY_LENGTH ? summary.substring(0, WIKI_SUMMARY_LENGTH) + '...' : summary;
        logger.info(`Successfully fetched and summarized Wikipedia content for "${best_title}".`);
        return { success: true, summary: conciseSummary };

    } catch (error) {
        logger.warn(`Wikipedia lookup for "${query}" failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}