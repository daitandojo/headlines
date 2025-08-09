// src/modules/email/index.js
import { logger } from '../../utils/logger.js';
import { sendPersonalizedEmail, performActualSupervisorEmailSend } from './mailer.js';
import SynthesizedEvent from '../../../models/SynthesizedEvent.js';
import { USERS } from '../../config/users.js';
import { newspaperToCountryMap, countryNameToFlagMap } from '../../config/sources.js';
import { createPersonalizedEmailBody } from './components/emailBodyBuilder.js';

/**
 * Groups a list of events by their country of origin.
 * @param {Array<Object>} events - A list of synthesized events.
 * @returns {Object} An object where keys are country names and values are arrays of events.
 */
function groupEventsByCountry(events) {
    const eventsByCountry = {};
    for (const event of events) {
        const primaryNewspaper = event.source_articles[0]?.newspaper;
        if (primaryNewspaper) {
            const country = newspaperToCountryMap.get(primaryNewspaper) || 'Other';
            if (!eventsByCountry[country]) {
                eventsByCountry[country] = [];
            }
            eventsByCountry[country].push(event);
        }
    }
    return eventsByCountry;
}

/**
 * Main function to send personalized wealth event emails to all configured users.
 * @returns {Promise<Object>} An object containing the total count of events processed.
 */
export async function sendWealthEventsEmail() {
    logger.info(`📧 Checking for new synthesized events to email...`);
    
    const eventsToSend = await SynthesizedEvent.find({ emailed: false }).sort({ createdAt: -1 }).lean();
    
    if (eventsToSend.length === 0) {
        logger.info('No new synthesized events to email.');
        return { eventsSentCount: 0 };
    }

    logger.info(`Found ${eventsToSend.length} new events to process for ${USERS.length} users.`);
    
    const allEventsByCountry = groupEventsByCountry(eventsToSend);
    let anyEmailSent = false;

    for (const user of USERS) {
        const userSpecificEventsByCountry = {};
        let eventCountForUser = 0;

        for (const country of user.countries) {
            if (allEventsByCountry[country]) {
                userSpecificEventsByCountry[country] = allEventsByCountry[country];
                eventCountForUser += allEventsByCountry[country].length;
            }
        }

        if (eventCountForUser === 0) {
            logger.info(`No new events for ${user.firstName}'s subscribed countries. Skipping email.`);
            continue;
        }

        const includedFlags = Object.keys(userSpecificEventsByCountry)
            .map(country => countryNameToFlagMap.get(country) || '')
            .join(' ');
        
        const subject = `${includedFlags} New Wealth Opportunities Detected`.trim();
        const body = createPersonalizedEmailBody(user, userSpecificEventsByCountry, subject);

        if (body) {
            const emailSentSuccessfully = await sendPersonalizedEmail({ user, subject, body });
            if (emailSentSuccessfully) {
                anyEmailSent = true;
            }
        }
    }

    // After processing all users, mark the events as emailed so they aren't sent again.
    if (anyEmailSent) {
        const eventIds = eventsToSend.map(e => e._id);
        await SynthesizedEvent.updateMany(
            { _id: { $in: eventIds } },
            { $set: { emailed: true, email_sent_at: new Date() } }
        );
        logger.info(`Successfully processed and marked ${eventsToSend.length} events as emailed.`);
    }

    return { eventsSentCount: eventsToSend.length };
}

/**
 * Coordinates sending the supervisor report email to all designated superusers.
 * @param {Object} runStats - Statistics about the current pipeline run.
 */
export async function sendSupervisorReportEmail(runStats) {
    if (!runStats) {
        logger.error('No runStats provided for supervisor report. Skipping email.');
        return;
    }
    
    logger.info('Preparing supervisor report email...');
    
    // Find all users with the superUser flag set to true.
    const superUserEmails = USERS.filter(user => user.superUser === true).map(user => user.email);

    if (superUserEmails.length === 0) {
        logger.warn('No superusers found in src/config/users.js. Skipping supervisor report.');
        return;
    }
    
    try {
        await performActualSupervisorEmailSend(runStats, superUserEmails);
        logger.info('✅ Supervisor report email successfully sent/queued to all superusers.');
    } catch (error) {
        logger.error({ err: error }, '💥 CRITICAL: Failed to send supervisor report email.');
    }
}