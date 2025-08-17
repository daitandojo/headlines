// src/modules/email/mailer.js (version 2.0)
import nodemailer from 'nodemailer'
import { logger } from '../../utils/logger.js'
import { safeExecute } from '../../utils/helpers.js'
import {
  SUPERVISOR_EMAIL_CONFIG,
  SMTP_CONFIG,
  IS_PRODUCTION,
  FORCE_EMAIL_SEND_DEV,
} from '../../config/index.js'
import { createSupervisorEmailBody } from './components/supervisorEmailBodyBuilder.js'
import { LOGO_CID, LOGO_PATH } from './constants.js' // <-- MODIFIED: Import CID and PATH

async function sendEmail(mailOptions, emailType) {
  if (!IS_PRODUCTION && !FORCE_EMAIL_SEND_DEV) {
    logger.warn(
      `[${emailType} Mailer] DEV MODE: Skipping actual email send to: ${mailOptions.to}`
    )
    return { skipped: true, reason: 'DEV mode' }
  }

  if (!SMTP_CONFIG?.auth?.user || !SMTP_CONFIG?.auth?.pass) {
    logger.error(`❌ [${emailType} Mailer] SMTP authentication not fully configured.`)
    return { error: 'SMTP authentication not fully configured.' }
  }

  logger.info(
    `📤 [${emailType} Mailer] Sending email via Nodemailer to: ${mailOptions.to}.`
  )

  const transporter = nodemailer.createTransport(SMTP_CONFIG)

  // --- NEW: Add the logo as an embedded attachment to every email ---
  if (!mailOptions.attachments) {
    mailOptions.attachments = []
  }
  mailOptions.attachments.push({
    filename: 'bullion.png', // The name of the file
    path: LOGO_PATH, // The local path to the file
    cid: LOGO_CID, // The Content-ID to reference in the HTML
  })
  // --- END NEW ---

  const sendResult = await safeExecute(() => transporter.sendMail(mailOptions), {
    errorHandler: (error) => {
      logger.error(`❌ [${emailType} Mailer] Nodemailer SMTP error:`, {
        message: error.message,
        code: error.code,
      })
      return { errorOccurred: true, details: error.message }
    },
  })

  if (sendResult && sendResult.errorOccurred) {
    return { error: `SMTP Error: ${sendResult.details}` }
  }

  logger.info(`✅ [${emailType} Mailer] Email sent successfully to ${mailOptions.to}.`)
  return { success: true }
}

export async function sendPersonalizedEmail({ user, subject, body }) {
  if (!user || !user.email) {
    logger.error(`❌ [Wealth Events Mailer] Invalid user object provided.`)
    return false
  }

  const mailOptions = {
    from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
    to: user.email,
    bcc: 'reconozco@gmail.com',
    subject: subject,
    html: body,
  }

  const result = await sendEmail(mailOptions, 'Wealth Events')
  return result.success || false
}

export async function performActualSupervisorEmailSend(runStats, recipients) {
  if (!recipients || recipients.length === 0) {
    logger.warn(
      '[Supervisor Mailer] Skipping: No superusers configured to receive this report.'
    )
    return
  }

  const emailBodyHtml = await createSupervisorEmailBody(runStats)
  if (!emailBodyHtml) {
    logger.error('❌ [Supervisor Mailer] HTML email body generation failed.')
    throw new Error('Failed to generate supervisor email body')
  }

  const mailOptions = {
    from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
    to: recipients.join(', '),
    subject: SUPERVISOR_EMAIL_CONFIG.subject,
    html: emailBodyHtml,
  }

  const result = await sendEmail(mailOptions, 'Supervisor Report')

  if (result.error) {
    throw new Error(`Failed to send supervisor email: ${result.error}`)
  }
}
