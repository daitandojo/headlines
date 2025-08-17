// src/modules/notifications/index.js (version 1.0)
import { logger } from '../../utils/logger.js'
import Subscriber from '../../../models/Subscriber.js'
import PushSubscription from '../../../models/PushSubscription.js'
import { sendBulkEmails } from './emailService.js'
import { sendBulkPushNotifications } from './pushService.js'

/**
 * Main orchestrator to send personalized notifications for new events and opportunities.
 * @param {Array<Object>} newEvents - Array of newly created SynthesizedEvent documents.
 * @param {Array<Object>} newOpportunities - Array of newly created Opportunity documents.
 */
export async function sendNotifications(newEvents, newOpportunities) {
  logger.info(
    `📧 Starting personalized notification dispatch for ${newEvents.length} events and ${newOpportunities.length} opportunities.`
  )

  // 1. Fetch all active subscribers and their push subscriptions in one go.
  const [activeSubscribers, allPushSubscriptions] = await Promise.all([
    Subscriber.find({ isActive: true }).lean(),
    PushSubscription.find().lean(),
  ])

  if (activeSubscribers.length === 0) {
    logger.info('No active subscribers found. Skipping notification dispatch.')
    return { emailSentCount: 0, pushSentCount: 0 }
  }

  // 2. Create a map for efficient lookup of push subscriptions per user.
  const pushSubsByUserId = allPushSubscriptions.reduce((acc, sub) => {
    const userId = sub.subscriberId.toString()
    if (!acc[userId]) acc[userId] = []
    acc[userId].push(sub)
    return acc
  }, {})

  // 3. Prepare data payloads grouped by country for efficient filtering.
  const eventsByCountry = groupItemsByCountry(newEvents, 'country')
  const opportunitiesByCountry = groupItemsByCountry(newOpportunities, 'basedIn')

  const emailQueue = []
  const pushQueue = []

  // 4. Iterate through each subscriber to build personalized notification payloads.
  for (const user of activeSubscribers) {
    const userCountries = new Set(user.countries || [])
    if (userCountries.size === 0) continue // Skip users with no subscribed countries.

    const userEvents = filterItemsForUser(eventsByCountry, userCountries)
    const userOpportunities = filterItemsForUser(opportunitiesByCountry, userCountries)

    if (userEvents.length === 0 && userOpportunities.length === 0) continue

    // 5. Queue emails for users with email notifications enabled.
    if (user.emailNotificationsEnabled) {
      emailQueue.push({
        user,
        events: userEvents,
        opportunities: userOpportunities,
      })
    }

    // 6. Queue push notifications for users with push enabled and active subscriptions.
    const userPushSubs = pushSubsByUserId[user._id.toString()] || []
    if (user.pushNotificationsEnabled && userPushSubs.length > 0) {
      pushQueue.push({
        subscriptions: userPushSubs,
        events: userEvents,
        opportunities: userOpportunities,
      })
    }
  }

  // 7. Dispatch notifications in bulk.
  const [emailSentCount, pushSentCount] = await Promise.all([
    sendBulkEmails(emailQueue),
    sendBulkPushNotifications(pushQueue),
  ])

  logger.info(
    `✅ Notification dispatch complete. Emails Sent: ${emailSentCount}, Push Notifications Sent: ${pushSentCount}.`
  )
  return { emailSentCount, pushSentCount }
}

// --- Helper Functions ---

function groupItemsByCountry(items, countryField) {
  return items.reduce((acc, item) => {
    const country = item[countryField]
    if (country) {
      if (!acc[country]) acc[country] = []
      acc[country].push(item)
    }
    return acc
  }, {})
}

function filterItemsForUser(itemsByCountry, userCountries) {
  const userItems = []
  for (const country of userCountries) {
    if (itemsByCountry[country]) {
      userItems.push(...itemsByCountry[country])
    }
  }
  return userItems
}
