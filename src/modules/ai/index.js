// src/modules/ai/index.js (version 2.8)
import pLimit from 'p-limit'
import client from './client.js'
import {
  LLM_MODEL_TRIAGE,
  LLM_MODEL_ARTICLES,
  AI_BATCH_SIZE,
  CONCURRENCY_LIMIT,
  HEADLINES_RELEVANCE_THRESHOLD,
  LLM_MODEL,
} from '../../config/index.js'
import { logger } from '../../utils/logger.js'
import { instructionHeadlines } from '../assessments/instructionHeadlines.js'
import {
  shotsInput as shotsInputHeadlines,
  shotsOutput as shotsOutputHeadlines,
} from '../assessments/shotsHeadlines.js'
import { instructionArticle } from '../assessments/instructionArticle.js'
import {
  shotsInput as shotsInputArticle,
  shotsOutput as shotsOutputArticle,
} from '../assessments/shotsArticle.js'
import { instructionContacts } from '../assessments/instructionContacts.js'
import { instructionEnrichContact } from '../assessments/instructionEnrichContact.js'
import { instructionOpportunities } from '../assessments/instructionOpportunities.js'
import { safeExecute, truncateString } from '../../utils/helpers.js'
import { performGoogleSearch } from '../../utils/serpapi.js'

const limit = pLimit(CONCURRENCY_LIMIT)
let isApiKeyInvalid = false

export async function performAiSanityCheck() {
  try {
    logger.info('🔬 Performing AI service sanity check (OpenAI)...')
    const response = await client.chat.completions.create(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'What is in one word the name of the capital of France',
          },
        ],
        temperature: 0,
      },
      { timeout: 20 * 1000 }
    )
    const answer = response.choices[0].message.content.trim().toLowerCase()
    if (answer.includes('paris')) {
      logger.info('✅ AI service sanity check passed.')
      return true
    } else {
      logger.fatal(`OpenAI sanity check failed. Expected "Paris", got: "${answer}".`)
      return false
    }
  } catch (error) {
    if (error.status === 401) {
      logger.fatal(`OpenAI sanity check failed due to INVALID API KEY (401).`)
    } else {
      logger.fatal(
        { err: error },
        'OpenAI sanity check failed with an unexpected API error.'
      )
    }
    isApiKeyInvalid = true
    return false
  }
}
export async function checkModelPermissions(requiredModels) {
  logger.info('🔬 Verifying permissions for configured OpenAI models...')
  try {
    const response = await client.models.list()
    const availableModels = new Set(response.data.map((model) => model.id))
    for (const model of requiredModels) {
      if (!availableModels.has(model)) {
        logger.fatal(`Model validation failed. Model "${model}" is not available.`)
        return false
      }
    }
    logger.info('✅ All configured models are available.')
    return true
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to retrieve model list from OpenAI API.')
    isApiKeyInvalid = true
    return false
  }
}

async function generateAssessment(
  model,
  instructions,
  userContent,
  fewShotInputs = [],
  fewShotOutputs = []
) {
  if (isApiKeyInvalid) {
    return { error: 'API Key is invalid. Halting further AI assessments.' }
  }
  const messages = [{ role: 'system', content: JSON.stringify(instructions) }]

  fewShotInputs.forEach((input, i) => {
    const shotContent = typeof input === 'string' ? input : JSON.stringify(input)
    if (shotContent) {
      messages.push({ role: 'user', content: shotContent })
      messages.push({ role: 'assistant', content: fewShotOutputs[i] })
    }
  })

  messages.push({ role: 'user', content: userContent })

  const result = await safeExecute(() =>
    client.chat.completions.create({
      model,
      messages,
      response_format: { type: 'json_object' },
    })
  )

  if (!result) return { error: 'API call failed' }

  try {
    return JSON.parse(result.choices[0].message.content)
  } catch (parseError) {
    logger.error(`JSON Parse Error: ${parseError.message}`)
    return { error: 'JSON Parsing Error' }
  }
}

export async function assessHeadlinesInBatches(articles) {
  const batches = []
  for (let i = 0; i < articles.length; i += AI_BATCH_SIZE) {
    batches.push(articles.slice(i, i + AI_BATCH_SIZE))
  }
  logger.info(`Assessing ${articles.length} headlines in ${batches.length} batches...`)
  const allAssessedPromises = []
  let completedBatches = 0
  for (const batch of batches) {
    allAssessedPromises.push(
      limit(async () => {
        const headlinesText = batch.map((a) => a.headline).join('\n- ')
        const response = await generateAssessment(
          LLM_MODEL_TRIAGE,
          instructionHeadlines,
          headlinesText,
          shotsInputHeadlines,
          shotsOutputHeadlines
        )
        completedBatches++
        logger.info(
          `\n--- [ BATCH ${completedBatches}/${batches.length} HEADLINE ANALYSIS ] ---`
        )
        if (response && response.assessment && Array.isArray(response.assessment)) {
          batch.forEach((article, i) => {
            const assessment = response.assessment[i]
            if (assessment && typeof assessment.relevance_headline === 'number') {
              const score = assessment.relevance_headline
              const comment = assessment.assessment_headline || 'No comment.'
              const emoji = score >= HEADLINES_RELEVANCE_THRESHOLD ? '✅' : '❌'
              logger.info(
                `${emoji} [${String(score).padStart(3)}] "${truncateString(article.headline, 60)}" (${article.source}) | ${truncateString(comment, 45)}`
              )
            } else {
              logger.warn(
                `- Malformed assessment for: "${truncateString(article.headline, 70)}" (${article.source})`
              )
            }
          })
        } else {
          logger.error(
            `❌ Headline assessment failed for batch ${completedBatches}/${batches.length}. Reason: ${response.error || 'Malformed response'}`
          )
        }
        if (
          response.error ||
          !response.assessment ||
          !Array.isArray(response.assessment) ||
          response.assessment.length !== batch.length
        ) {
          return batch.map((article) => ({
            ...article,
            relevance_headline: 0,
            assessment_headline: response.error || 'AI assessment failed.',
          }))
        }
        return batch.map((article, i) => ({ ...article, ...response.assessment[i] }))
      })
    )
  }
  const assessedBatches = await Promise.all(allAssessedPromises)
  logger.info('Finished assessing all headline batches.')
  return assessedBatches.flat()
}
export async function assessArticleContent(article) {
  const articleText = `HEADLINE: ${article.headline}\n\nBODY:\n${article.articleContent.contents.join('\n')}`
  const response = await generateAssessment(
    LLM_MODEL_ARTICLES,
    instructionArticle,
    articleText,
    shotsInputArticle,
    shotsOutputArticle
  )
  if (response.error) {
    logger.error(`Article assessment failed for ${article.link}.`)
    return { ...article, error: `AI Error: ${response.error}` }
  }
  return { ...article, ...response, error: null }
}

export async function extractKeyContacts(article) {
  const articleText = `HEADLINE: ${article.headline_en || article.headline}\n\nSUMMARY: ${article.topic}\n\nFULL TEXT SNIPPET:\n${truncateString((article.articleContent?.contents || []).join('\n'), 1500)}`

  // --- NEW: Add a specific few-shot example to guide the AI ---
  const fewShotInputs = [
    `HEADLINE: Another great year for Aksel Lund Svindal's finances\n\nSUMMARY: Profile on the financial success of former athlete Aksel Lund Svindal.`,
  ]
  const fewShotOutputs = [
    JSON.stringify({
      key_individuals: [
        {
          name: 'Aksel Lund Svindal',
          role_in_event: 'Subject of Wealth Profile',
          company: 'A Management',
          email_suggestion: 'aksel@svindal.no',
        },
      ],
    }),
  ]
  // --- END NEW ---

  const response = await generateAssessment(
    LLM_MODEL,
    instructionContacts,
    articleText,
    fewShotInputs,
    fewShotOutputs
  )

  if (response.error || !response.key_individuals) {
    logger.warn(`Contact extraction failed for ${article.link}.`, {
      error: response.error,
    })
    return { key_individuals: [] }
  }

  logger.info(
    `[Contact Agent] Initial extraction found ${response.key_individuals.length} potential contact(s) for "${truncateString(article.headline, 50)}"`
  )
  return response
}

export async function enrichContact(contact, article) {
  const researchQuery = `${contact.name} ${contact.company || article.newspaper}`
  const searchResult = await performGoogleSearch(researchQuery)
  if (!searchResult.success) {
    return [contact]
  }
  const context = `Initial Contact Profile:\n${JSON.stringify(contact)}\n\nSource Article Headline: ${article.headline}\n\nGoogle Search Snippets:\n${searchResult.snippets}`
  const response = await generateAssessment(LLM_MODEL, instructionEnrichContact, context)
  if (
    response.error ||
    !response.enriched_contacts ||
    response.enriched_contacts.length === 0
  ) {
    logger.warn(
      `[Enrichment Agent] Failed to enrich contact "${contact.name}". Returning original.`
    )
    return [contact]
  }
  logger.info(
    `[Enrichment Agent] Successfully enriched contact: "${contact.name}" -> "${response.enriched_contacts.map((c) => c.name).join(', ')}"`
  )
  return response.enriched_contacts
}
export async function generateOpportunitiesFromArticle(article) {
  const inputText = `
        Headline: ${article.headline_en || article.headline}
        Source: ${article.newspaper}
        Link: ${article.link}
        AI Summary: ${article.topic || article.assessment_article}
        Enriched Key Individuals: ${JSON.stringify(article.key_individuals, null, 2)}
        Full Text Snippet: ${truncateString((article.articleContent?.contents || []).join(' '), 1500)}
    `
  const response = await generateAssessment(
    LLM_MODEL,
    instructionOpportunities,
    inputText
  )
  if (response.error || !response.opportunities) {
    logger.warn(`Opportunity generation failed for ${article.link}.`, {
      error: response.error,
    })
    return []
  }
  logger.info(
    `[Opportunity Agent] Generated ${response.opportunities.length} opportunity/ies from "${truncateString(article.headline, 50)}"`
  )
  return response.opportunities
}
