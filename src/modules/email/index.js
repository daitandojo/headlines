// File: src/modules/email/index.js
// src/modules/email/index.js (version 2.1 - Add User Event Count Logging)
import { logger } from '../../utils/logger.js'
import { sendPersonalizedEmail, performActualSupervisorEmailSend } from './mailer.js'
import Subscriber from '../../../models/Subscriber.js'
import { newspaperToCountryMap, countryNameToFlagMap } from '../../config/sources.js'
import { createPersonalizedEmailBody } from './components/emailBodyBuilder.js'

/**
 * Main function to send personalized wealth event emails for newly synthesized events.
 * @param {Array<Object>} newEvents - The array of event objects that were just created in this pipeline run.
 * @returns {Promise<{eventsSentCount: number}>} An object containing the count of events processed for email.
 */
export async function sendWealthEventsEmail(newEvents) {
  if (!newEvents || newEvents.length === 0) {
    logger.info('No new synthesized events were provided for emailing.')
    return { eventsSentCount: 0 }
  }

  const subscribersToEmail = await Subscriber.find({
    isActive: true,
    emailNotificationsEnabled: true,
  }).lean()

  if (subscribersToEmail.length === 0) {
    logger.info(
      'No active subscribers with email notifications enabled. Skipping emails.'
    )
    return { eventsSentCount: 0 }
  }

  logger.info(
    `📧 Processing ${newEvents.length} new synthesized events for ${subscribersToEmail.length} users...`
  )

  const eventsByCountry = {}
  for (const event of newEvents) {
    const country = event.country || 'Other'
    if (!eventsByCountry[country]) {
      eventsByCountry[country] = []
    }
    eventsByCountry[country].push(event)
  }

  let anyEmailSent = false

  for (const user of subscribersToEmail) {
    const userSpecificEventsByCountry = {}
    let eventCountForUser = 0

    // Ensure user.countries is an array before iterating
    const userCountries = user.countries || []
    for (const country of userCountries) {
      if (eventsByCountry[country]) {
        userSpecificEventsByCountry[country] = eventsByCountry[country]
        eventCountForUser += eventsByCountry[country].length
      }
    }

    if (eventCountForUser === 0) {
      logger.info(
        `No new events for ${user.firstName}'s subscribed countries. Skipping email.`
      )
      continue
    }

    // --- NEW: Log how many events a user is about to receive ---
    logger.info(
      `Preparing to send email to ${user.firstName} with ${eventCountForUser} event(s).`
    )
    // --- END NEW LOGGING ---

    const includedFlags = Object.keys(userSpecificEventsByCountry)
      .map((country) => countryNameToFlagMap.get(country) || '')
      .join(' ')

    const subject = `${includedFlags} New Wealth Opportunities`.trim()
    const body = createPersonalizedEmailBody(user, userSpecificEventsByCountry, subject)

    if (body) {
      const emailSentSuccessfully = await sendPersonalizedEmail({ user, subject, body })
      if (emailSentSuccessfully) {
        anyEmailSent = true
      }
    }
  }

  if (anyEmailSent) {
    logger.info(`Successfully sent emails containing ${newEvents.length} new events.`)
  }

  return { eventsSentCount: newEvents.length }
}

/**
 * Coordinates sending the supervisor report email.
 * @param {Object} runStats - Statistics about the current pipeline run.
 */
export async function sendSupervisorReportEmail(runStats) {
  if (!runStats) {
    logger.error('No runStats provided for supervisor report. Skipping email.')
    return
  }

  logger.info('Preparing supervisor report email...')

  const superUsers = await Subscriber.find({
    isActive: true,
    role: 'admin',
  })
    .select('email')
    .lean()

  const superUserEmails = superUsers.map((user) => user.email)

  if (superUserEmails.length === 0) {
    logger.warn('No admin users found. Skipping supervisor report.')
    return
  }

  try {
    await performActualSupervisorEmailSend(runStats, superUserEmails)
    logger.info('✅ Supervisor report email successfully sent/queued to all superusers.')
  } catch (error) {
    logger.error({ err: error }, '💥 CRITICAL: Failed to send supervisor report email.')
  }
}
