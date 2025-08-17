// src/modules/push/index.js (version 2.0)
import webpush from 'web-push';
import { logger } from '../../utils/logger.js';
import PushSubscription from '../../../models/PushSubscription.js';
import { truncateString } from '../../utils/helpers.js';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let isPushConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
    webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
    isPushConfigured = true;
    logger.info('Push notification service configured successfully.');
} else {
    logger.warn('VAPID keys not configured. Push notifications will be disabled.');
}

/**
 * A generic helper to send a given payload to all subscribed users.
 * @param {object} payload The notification payload object to be sent.
 */
async function sendNotificationToAll(payload) {
    if (!isPushConfigured) return;

    try {
        const subscriptions = await PushSubscription.find().lean();
        if (subscriptions.length === 0) return;

        logger.info(`📢 Sending push notification to ${subscriptions.length} subscriber(s)...`);
        
        const notificationPayload = JSON.stringify(payload);

        const promises = subscriptions.map(subscription => 
            webpush.sendNotification(subscription, notificationPayload)
                .catch(error => {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        logger.info(`Subscription expired or invalid for endpoint: ${subscription.endpoint}. Deleting.`);
                        return PushSubscription.deleteOne({ _id: subscription._id });
                    } else {
                        logger.error({ err: error }, `Failed to send push notification to ${subscription.endpoint}`);
                    }
                })
        );
        
        await Promise.all(promises);

    } catch (error) {
        logger.error({ err: error }, 'A critical error occurred while sending push notifications.');
    }
}

/**
 * Sends push notifications for newly created events to all subscribed users.
 * @param {Array<Object>} newEvents - An array of newly synthesized event objects.
 */
export async function sendEventPushNotifications(newEvents) {
    if (!newEvents || newEvents.length === 0) return;
    
    const payload = {
        title: `New Intelligence Alert: ${newEvents.length} Event(s)`,
        body: `Headline: "${newEvents[0].synthesized_headline}"`,
        url: '/events',
        icon: '/icons/icon-192x192.png',
    };
    await sendNotificationToAll(payload);
}

/**
 * Sends a push notification for a single, highly relevant article.
 * @param {Object} article - The article object that met the relevance threshold.
 */
export async function sendArticlePushNotification(article) {
    if (!article || !article._id) return;

    logger.info(`Preparing push notification for relevant article: "${truncateString(article.headline, 50)}"`);

    const payload = {
        title: 'New Relevant Article',
        body: article.headline_en || article.headline,
        url: article.link,
        icon: '/icons/icon-192x192.png',
        // --- NEW: Add properties for stacking and persistence ---
        // `requireInteraction: true` makes the notification persistent until the user dismisses it.
        requireInteraction: true,
        // `tag` ensures that if the same article is processed again, the notification is updated
        // instead of creating a new one. A unique tag per article allows different article
        // notifications to stack.
        tag: `article-id-${article._id.toString()}`
    };
    await sendNotificationToAll(payload);
}