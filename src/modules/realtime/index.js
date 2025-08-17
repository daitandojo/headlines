// File: src/modules/realtime/index.js

// src/modules/realtime/index.js (version 2.0)
import Pusher from 'pusher';
import { logger } from '../../utils/logger.js';

const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

let pusher;
const isRealtimeConfigured = PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER;

if (isRealtimeConfigured) {
    pusher = new Pusher({
        appId: PUSHER_APP_ID,
        key: PUSHER_KEY,
        secret: PUSHER_SECRET,
        cluster: PUSHER_CLUSTER,
        useTLS: true
    });
    logger.info('Real-time notification service (Pusher) configured.');
} else {
    logger.warn('Pusher credentials not fully configured. Real-time updates will be disabled.');
}

/**
 * A generic helper to stream a new data item to a specific channel.
 * @param {string} channel - The channel to publish on (e.g., 'articles-channel').
 * @param {string} event - The event name to trigger (e.g., 'new-article').
 * @param {object} data - The JSON payload to send.
 */
async function streamNewItem(channel, event, data) {
    if (!isRealtimeConfigured) {
        return;
    }
    try {
        logger.info(`📢 Streaming new item on channel '${channel}' with event '${event}'.`);
        await pusher.trigger(channel, event, data);
    } catch (error) {
        logger.error({ err: error, channel, event }, 'Failed to trigger Pusher real-time event.');
    }
}

/**
 * Streams a newly synthesized event to all connected clients.
 * @param {object} event - The full synthesized event object.
 */
export async function streamNewEvent(event) {
    await streamNewItem('events-channel', 'new-event', event);
}

/**
 * Streams a newly identified relevant article to all connected clients.
 * @param {object} article - The full article object.
 */
export async function streamNewArticle(article) {
    // --- FIX: Create a lightweight payload for Pusher to avoid exceeding the 10KB limit ---
    const lightweightArticle = {
        _id: article._id,
        headline: article.headline,
        headline_en: article.headline_en,
        link: article.link,
        newspaper: article.newspaper,
        country: article.country,
        topic: article.topic,
        relevance_article: article.relevance_article,
        assessment_article: article.assessment_article,
        key_individuals: (article.key_individuals || []).map(p => ({ name: p.name, role_in_event: p.role_in_event, company: p.company })),
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
    };
    // --- END FIX ---
    await streamNewItem('articles-channel', 'new-article', lightweightArticle);
}