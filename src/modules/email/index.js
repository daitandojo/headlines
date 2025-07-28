// src/modules/email/index.js
import { logger } from '../../utils/logger.js';
import { performActualEmailSend, performActualSupervisorEmailSend } from './mailer.js';
import SynthesizedEvent from '../../../models/SynthesizedEvent.js';

/**
 * Fetches unsent synthesized events, sends them in an email, and updates their status.
 * @returns {Promise<Object>} An object containing the count of events sent.
 */
export async function sendWealthEventsEmail() {
    logger.info(`📧 Checking for new synthesized events to email...`);
    
    const eventsToSend = await SynthesizedEvent.find({ emailed: false }).sort({ createdAt: -1 }).lean();
    
    if (eventsToSend.length === 0) {
        logger.info('No new synthesized events to email.');
        return { eventsSentCount: 0 };
    }

    logger.info(`Found ${eventsToSend.length} new events to include in the wealth events email.`);
    
    const sortedEvents = [...eventsToSend].sort((a, b) => b.highest_relevance_score - a.highest_relevance_score);

    const emailSentSuccessfully = await performActualEmailSend(sortedEvents);

    if (emailSentSuccessfully) {
        const eventIds = eventsToSend.map(e => e._id);
        await SynthesizedEvent.updateMany(
            { _id: { $in: eventIds } },
            { $set: { emailed: true, email_sent_at: new Date() } }
        );
        logger.info(`Marked ${eventsToSend.length} events as emailed.`);
        return { eventsSentCount: eventsToSend.length };
    } else {
        logger.error('Wealth events email was not sent due to an error or dev mode skipping.');
        return { eventsSentCount: 0 };
    }
}

/**
 * Coordinates sending the supervisor report email.
 * @param {Object} runStats - Statistics about the current pipeline run.
 */
export async function sendSupervisorReportEmail(runStats) {
    if (!runStats) {
        logger.error('No runStats provided for supervisor report. Skipping email.');
        return;
    }
    
    logger.info('Preparing supervisor report email...');
    
    try {
        await performActualSupervisorEmailSend(runStats);
        logger.info('✅ Supervisor report email successfully sent/queued.');
    } catch (error) {
        logger.error({ err: error }, '💥 CRITICAL: Failed to send supervisor report email.');
    }
}