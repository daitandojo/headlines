// src/modules/email/mailer.js
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.js';
import { safeExecute } from '../../utils/helpers.js';
import {
  HEADLINE_RECIPIENTS,
  SUPERVISOR_EMAIL,
  EMAIL_CONFIG,
  SUPERVISOR_EMAIL_CONFIG,
  SMTP_CONFIG,
  SEND_TO_DEFAULT_SUPERVISOR,
  IS_PRODUCTION,
  FORCE_EMAIL_SEND_DEV
} from '../../config/index.js';
import { createEmailBody } from './components/emailBodyBuilder.js';
import { createSupervisorEmailBody } from './components/supervisorEmailBodyBuilder.js';

const SMTP_UNCONFIGURED_MSG = 'SMTP authentication not fully configured.';
const RECIPIENTS_UNCONFIGURED_MSG = 'Email recipients not configured.';

async function sendEmail(mailOptions, emailType) {
    if (!IS_PRODUCTION && !FORCE_EMAIL_SEND_DEV) {
        logger.warn(`[${emailType} Mailer] DEV MODE: Skipping actual email send to: ${mailOptions.to}`);
        return { skipped: true, reason: 'DEV mode' };
    }

    if (!SMTP_CONFIG?.auth?.user || !SMTP_CONFIG?.auth?.pass) {
        logger.error(`❌ [${emailType} Mailer] ${SMTP_UNCONFIGURED_MSG}`);
        return { error: SMTP_UNCONFIGURED_MSG };
    }

    logger.info(`📤 [${emailType} Mailer] Sending email via Nodemailer to: ${mailOptions.to}.`);

    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    const sendResult = await safeExecute(() => transporter.sendMail(mailOptions), {
        errorHandler: (error) => {
            logger.error(`❌ [${emailType} Mailer] Nodemailer SMTP error:`, { message: error.message, code: error.code });
            return { errorOccurred: true, details: error.message };
        },
    });

    if (sendResult && sendResult.errorOccurred) {
        return { error: `SMTP Error: ${sendResult.details}` };
    }

    logger.info(`✅ [${emailType} Mailer] Email sent successfully.`);
    return { success: true };
}

export async function performActualEmailSend(eventsForEmail) {
    if (!HEADLINE_RECIPIENTS || HEADLINE_RECIPIENTS.length === 0) {
        logger.error(`❌ [Wealth Events Mailer] ${RECIPIENTS_UNCONFIGURED_MSG}`);
        return false;
    }

    const emailBodyHtml = createEmailBody(eventsForEmail);
    if (!emailBodyHtml) {
        logger.error('❌ [Wealth Events Mailer] HTML email body generation failed.');
        return false;
    }

    const mailOptions = {
        from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
        to: HEADLINE_RECIPIENTS.join(', '),
        subject: EMAIL_CONFIG.subject,
        html: emailBodyHtml,
    };

    const result = await sendEmail(mailOptions, 'Wealth Events');
    return result.success || false;
}

export async function performActualSupervisorEmailSend(runStats) {
    if (!SUPERVISOR_EMAIL || (SUPERVISOR_EMAIL.toLowerCase().includes('default') && !SEND_TO_DEFAULT_SUPERVISOR)) {
        logger.warn('[Supervisor Mailer] Skipping: Supervisor email not configured or is default.');
        return;
    }

    // CRITICAL FIX: The function createSupervisorEmailBody is now async, so we must 'await' it.
    const emailBodyHtml = await createSupervisorEmailBody(runStats);
    if (!emailBodyHtml) {
        logger.error('❌ [Supervisor Mailer] HTML email body generation failed.');
        throw new Error('Failed to generate supervisor email body');
    }

    const mailOptions = {
        from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
        to: SUPERVISOR_EMAIL,
        subject: SUPERVISOR_EMAIL_CONFIG.subject,
        html: emailBodyHtml,
    };

    const result = await sendEmail(mailOptions, 'Supervisor Report');

    if (result.error) {
        throw new Error(`Failed to send supervisor email: ${result.error}`);
    }
}