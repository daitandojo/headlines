// src/pipeline/5_commitAndNotify.js (version 4.1)
import { logger } from '../utils/logger.js'
import { savePipelineResults } from '../modules/dataStore/index.js'
import { sendSupervisorReportEmail } from '../modules/email/index.js'
import { streamNewEvent, streamNewArticle } from '../modules/realtime/index.js'
import SynthesizedEvent from '../../models/SynthesizedEvent.js'
import Opportunity from '../../models/Opportunity.js'
import { ARTICLES_RELEVANCE_THRESHOLD } from '../config/index.js'
import { sendNotifications } from '../modules/notifications/index.js'

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

  let savedEvents = []
  let savedOpportunities = []

  if (dbConnection && (!runStats.errors || runStats.errors.length === 0)) {
    // --- DATABASE COMMIT PHASE ---
    const commitResult = await savePipelineResults(
      assessedCandidates,
      synthesizedEventsToSave || []
    )

    if (commitResult.success) {
      savedEvents = commitResult.savedEvents

      // --- UPSERT and LINK opportunities ---
      if (
        opportunitiesToSave &&
        opportunitiesToSave.length > 0 &&
        savedEvents.length > 0
      ) {
        logger.info('Upserting and linking opportunities...')
        const articleToEventMap = new Map()
        savedEvents.forEach((event) => {
          ;(event.source_articles || []).forEach((article) => {
            articleToEventMap.set(article.link, event._id)
          })
        })

        const articleIdToLinkMap = new Map()
        ;(assessedCandidates || []).forEach((article) => {
          articleIdToLinkMap.set(article._id.toString(), article.link)
        })

        const ops = opportunitiesToSave
          .map((opp) => {
            const articleLink = articleIdToLinkMap.get(opp.sourceArticleId.toString())
            const eventId = articleToEventMap.get(articleLink)
            if (!eventId) {
              logger.warn(
                { opp },
                'Could not find parent event for opportunity. Skipping event link.'
              )
              return null // Skip this operation
            }

            const updatePayload = {
              $set: {
                contactDetails: opp.contactDetails,
                basedIn: opp.basedIn,
                sourceArticleId: opp.sourceArticleId,
                sourceEventId: eventId,
              },
              $push: { whyContact: { $each: [opp.whyContact].flat(), $position: 0 } },
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
          .filter(Boolean) // Filter out null operations

        if (ops.length > 0) {
          try {
            const result = await Opportunity.bulkWrite(ops)
            const opportunityNames = opportunitiesToSave.map((o) => o.reachOutTo)
            savedOpportunities = await Opportunity.find({
              reachOutTo: { $in: opportunityNames },
            })
              .populate('sourceArticleId', 'link')
              .lean()
            logger.info(
              `Opportunities processed. Created: ${result.upsertedCount}, Updated: ${result.modifiedCount}.`
            )
          } catch (error) {
            logger.error({ err: error }, 'Failed to save/update opportunities.')
          }
        }
      }

      // --- REALTIME STREAMING PHASE ---
      if (savedEvents.length > 0) {
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

      // --- PERSONALIZED NOTIFICATION PHASE ---
      if (savedEvents.length > 0 || savedOpportunities.length > 0) {
        const { emailSentCount, pushSentCount } = await sendNotifications(
          savedEvents,
          savedOpportunities
        )
        runStats.eventsEmailed = emailSentCount // Keep this stat for supervisor report consistency

        if (emailSentCount > 0) {
          const eventIds = savedEvents.map((e) => e._id)
          await SynthesizedEvent.updateMany(
            { _id: { $in: eventIds } },
            { $set: { emailed: true, email_sent_at: new Date() } }
          )
        }
      }
    } else {
      runStats.errors.push('CRITICAL: Failed to commit pipeline results.')
    }
  }

  // --- SUPERVISOR REPORT PHASE ---
  await sendSupervisorReportEmail(runStats)

  return { success: true, payload: pipelinePayload }
}
