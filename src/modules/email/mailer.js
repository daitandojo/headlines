// File: src/modules/email/mailer.js (version 1.01)
import nodemailer from 'nodemailer';
import { getLogger } from '@daitanjs/development';
import { safeExecute } from '@daitanjs/utilities';
import {
  HEADLINE_RECIPIENTS,
  SUPERVISOR_EMAIL,
  EMAIL_CONFIG,
  SUPERVISOR_EMAIL_CONFIG,
  SMTP_CONFIG,
  SEND_TO_DEFAULT_SUPERVISOR,
  IS_PRODUCTION,
} from '../../config/index.js';
import { createEmailBody } from './components/emailBodyBuilder.js';
import { createSupervisorEmailBody } from './components/supervisorEmailBodyBuilder.js';

const logger = getLogger('headlines-mongo-mailer');

const SMTP_UNCONFIGURED_MSG = 'SMTP authentication not fully configured.';
const RECIPIENTS_UNCONFIGURED_MSG = 'Email recipients not configured.';
const EMAIL_BODY_FAILED_MSG = 'HTML email body generation failed.';

/**
 * Sends the main "Wealth Events" email directly using nodemailer.
 * @param {Array<Object>} articlesForThisEmail - Pre-filtered articles to include.
 * @returns {Promise<Array<Object>>} The articles array with updated email status fields.
 */
export async function performActualEmailSend(articlesForThisEmail) {
  const emailType = 'Wealth Events';
  const articlesWithSendStatus = articlesForThisEmail.map((a) => ({
    ...a,
    emailed: false,
    email_error: null,
  }));

  if (!HEADLINE_RECIPIENTS || HEADLINE_RECIPIENTS.length === 0) {
    logger.error(`❌ [${emailType} Mailer] ${RECIPIENTS_UNCONFIGURED_MSG}`);
    return articlesWithSendStatus.map((a) => ({
      ...a,
      email_error: RECIPIENTS_UNCONFIGURED_MSG,
    }));
  }
  if (!SMTP_CONFIG?.auth?.user || !SMTP_CONFIG?.auth?.pass) {
    logger.error(`❌ [${emailType} Mailer] ${SMTP_UNCONFIGURED_MSG}`);
    return articlesWithSendStatus.map((a) => ({
      ...a,
      email_error: SMTP_UNCONFIGURED_MSG,
    }));
  }

  const emailBodyHtml = createEmailBody(articlesForThisEmail, EMAIL_CONFIG);
  if (!emailBodyHtml) {
    logger.error(`❌ [${emailType} Mailer] ${EMAIL_BODY_FAILED_MSG}`);
    return articlesWithSendStatus.map((a) => ({
      ...a,
      email_error: EMAIL_BODY_FAILED_MSG,
    }));
  }

  // --- REFACTOR: Use nodemailer directly ---
  const transporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure, // true for 465, false for other ports
    auth: SMTP_CONFIG.auth,
  });

  const mailOptions = {
    to: HEADLINE_RECIPIENTS,
    subject: EMAIL_CONFIG.subject,
    html: emailBodyHtml,
    from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
  };

  if (!IS_PRODUCTION && !process.env.FORCE_EMAIL_SEND_DEV) {
    logger.warn(`[${emailType} Mailer] DEV MODE: Skipping actual email send.`);
    return articlesWithSendStatus.map((article) => ({
      ...article,
      email_skipped_reason: 'DEV mode',
    }));
  }

  logger.info(
    `📤 [${emailType} Mailer] Sending email to: ${mailOptions.to.join(', ')}.`
  );
  const sendResult = await safeExecute(() => transporter.sendMail(mailOptions), {
    errorHandler: (error) => {
      logger.error(`❌ [${emailType} Mailer] SMTP error:`, {
        message: error.message,
        code: error.code,
      });
      return { errorOccurred: true, details: error.message };
    },
  });

  if (sendResult && sendResult.errorOccurred) {
    const errorDetail = `SMTP Error: ${sendResult.details}`;
    return articlesWithSendStatus.map((a) => ({
      ...a,
      email_error: errorDetail,
    }));
  } else {
    logger.info(`✅ [${emailType} Mailer] Email sent successfully.`);
    return articlesWithSendStatus.map((article) => ({
      ...article,
      emailed: true,
    }));
  }
}

/**
 * Sends the supervisor report email directly using nodemailer.
 * @param {Array<Object>} allAssessedFreshHeadlines
 * @param {Object} runStats
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
export async function performActualSupervisorEmailSend(
  allAssessedFreshHeadlines,
  runStats
) {
  const emailType = 'Supervisor Report';
  if (
    !SUPERVISOR_EMAIL ||
    (SUPERVISOR_EMAIL.toLowerCase() === 'your-supervisor-default@example.com' &&
      !SEND_TO_DEFAULT_SUPERVISOR)
  ) {
    const reason = !SUPERVISOR_EMAIL
      ? RECIPIENTS_UNCONFIGURED_MSG
      : 'Default supervisor email, send disabled.';
    logger.warn(`[${emailType} Mailer] Skipping: ${reason}`);
    return { sent: false, reason };
  }
  if (!SMTP_CONFIG?.auth?.user || !SMTP_CONFIG?.auth?.pass) {
    logger.error(`❌ [${emailType} Mailer] ${SMTP_UNCONFIGURED_MSG}`);
    return { sent: false, reason: SMTP_UNCONFIGURED_MSG };
  }

  const emailBodyHtml = createSupervisorEmailBody(
    allAssessedFreshHeadlines,
    runStats,
    SUPERVISOR_EMAIL_CONFIG
  );
  if (!emailBodyHtml) {
    logger.error(`❌ [${emailType} Mailer] ${EMAIL_BODY_FAILED_MSG}`);
    return { sent: false, reason: EMAIL_BODY_FAILED_MSG };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: SMTP_CONFIG.auth,
  });

  const mailOptions = {
    to: [SUPERVISOR_EMAIL],
    subject: SUPERVISOR_EMAIL_CONFIG.subject,
    html: emailBodyHtml,
    from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
  };

  if (!IS_PRODUCTION && !process.env.FORCE_EMAIL_SEND_DEV) {
    logger.warn(
      `[${emailType} Mailer] DEV MODE: Skipping actual supervisor email send.`
    );
    return { sent: false, reason: 'DEV mode' };
  }

  logger.info(
    `📤 [${emailType} Mailer] Sending email to: ${mailOptions.to.join(', ')}.`
  );
  const sendResult = await safeExecute(() => transporter.sendMail(mailOptions), {
    errorHandler: (error) => {
      logger.error(`❌ [${emailType} Mailer] SMTP error:`, {
        message: error.message,
        code: error.code,
      });
      return { errorOccurred: true, details: error.message };
    },
  });

  if (sendResult && sendResult.errorOccurred) {
    const errorDetail = `SMTP Error: ${sendResult.details}`;
    logger.error(`❌ [${emailType} Mailer] Sending failed. ${errorDetail}`);
    return { sent: false, reason: errorDetail };
  } else {
    logger.info(`✅ [${emailType} Mailer] Supervisor email sent successfully.`);
    return { sent: true };
  }
}