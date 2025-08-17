// File: src/pipeline/5_commitAndNotify.js

// src/pipeline/5_commitAndNotify.js (version 4.0)
import { logger } from '../utils/logger.js'
import { savePipelineResults } from '../modules/dataStore/index.js'
import {
  sendWealthEventsEmail,
  sendSupervisorReportEmail,
} from '../modules/email/index.js'
import {
  sendEventPushNotifications,
  sendArticlePushNotification,
} from '../modules/push/index.js'
import { streamNewEvent, streamNewArticle } from '../modules/realtime/index.js'
import SynthesizedEvent from '../../models/SynthesizedEvent.js'
import Opportunity from '../../models/Opportunity.js' // NEW
import { ARTICLES_RELEVANCE_THRESHOLD } from '../config/index.js'

const MIN_EMAIL_RELEVANCE_SCORE = 50

/**
 * Stage 5: Commits all results to the database and sends notifications.
 * @param {object} pipelinePayload - The main pipeline payload object.
 * @returns {Promise<{success: boolean, payload: object}>}
 */
export async function runCommitAndNotify(pipelinePayload) {
  logger.info('--- STAGE 5: COMMIT & NOTIFY ---')
  const {
    assessedCandidates,
    synthesizedEventsToSave,
    opportunitiesToSave,
    runStats,
    dbConnection,
  } = pipelinePayload

  if (dbConnection && (!runStats.errors || runStats.errors.length === 0)) {
    const { success, savedEvents } = await savePipelineResults(
      assessedCandidates,
      synthesizedEventsToSave || []
    )

    // --- NEW: UPSERT and LINK opportunities ---
    if (
      opportunitiesToSave &&
      opportunitiesToSave.length > 0 &&
      savedEvents &&
      savedEvents.length > 0
    ) {
      logger.info('Upserting and linking opportunities...')
      const articleToEventMap = new Map()
      savedEvents.forEach((event) => {
        event.source_articles.forEach((article) => {
          articleToEventMap.set(article.link, event._id)
        })
      })

      const articleIdToLinkMap = new Map()
      ;(assessedCandidates || []).forEach((article) => {
        articleIdToLinkMap.set(article._id.toString(), article.link)
      })

      const ops = opportunitiesToSave.map((opp) => {
        const articleLink = articleIdToLinkMap.get(opp.sourceArticleId.toString())
        const eventId = articleToEventMap.get(articleLink)

        const updatePayload = {
          $set: {
            contactDetails: opp.contactDetails,
            basedIn: opp.basedIn,
            sourceArticleId: opp.sourceArticleId,
            ...(eventId && { sourceEventId: eventId }),
          },
          $push: {
            whyContact: {
              $each: [opp.whyContact],
              $position: 0,
            },
          },
          // Only update wealth if the new event suggests a higher amount
          $max: { likelyMMDollarWealth: opp.likelyMMDollarWealth },
        }

        return {
          updateOne: {
            filter: { reachOutTo: opp.reachOutTo },
            update: updatePayload,
            upsert: true,
          },
        }
      })

      try {
        const result = await Opportunity.bulkWrite(ops)
        logger.info(
          `Opportunities processed. Created: ${result.upsertedCount}, Updated: ${result.modifiedCount}.`
        )
      } catch (error) {
        logger.error({ err: error }, 'Failed to save/update opportunities.')
      }
    }
    // --- END NEW LOGIC ---

    if (success) {
      if (savedEvents && savedEvents.length > 0) {
        for (const event of savedEvents) await streamNewEvent(event)
      }
      if (assessedCandidates && assessedCandidates.length > 0) {
        const relevantArticles = assessedCandidates.filter(
          (article) =>
            article.relevance_article &&
            article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD
        )
        for (const article of relevantArticles) await streamNewArticle(article)
      }

      const relevantArticlesForPush = (assessedCandidates || []).filter(
        (article) =>
          article.relevance_article &&
          article.relevance_article >= ARTICLES_RELEVANCE_THRESHOLD
      )
      for (const article of relevantArticlesForPush)
        await sendArticlePushNotification(article)

      if (savedEvents && savedEvents.length > 0) {
        const eventsForNotification = savedEvents.filter(
          (event) => event.highest_relevance_score >= MIN_EMAIL_RELEVANCE_SCORE
        )
        if (eventsForNotification.length > 0) {
          await sendEventPushNotifications(eventsForNotification)
          const emailResult = await sendWealthEventsEmail(eventsForNotification)
          runStats.eventsEmailed = emailResult.eventsSentCount || 0
          const eventIds = eventsForNotification.map((e) => e._id)
          await SynthesizedEvent.updateMany(
            { _id: { $in: eventIds } },
            { $set: { emailed: true, email_sent_at: new Date() } }
          )
        }
      }
    } else {
      runStats.errors.push('CRITICAL: Failed to commit pipeline results.')
    }

    await sendSupervisorReportEmail(runStats)
  } else if (dbConnection) {
    await sendSupervisorReportEmail(runStats)
  }

  return { success: true, payload: pipelinePayload }
}
