// src/modules/notifications/emailService.js (version 1.0)
import nodemailer from 'nodemailer'
import { logger } from '../../utils/logger.js'
import { SMTP_CONFIG, IS_PRODUCTION, FORCE_EMAIL_SEND_DEV } from '../../config/index.js'
import { configStore } from '../../config/dynamicConfig.js'

const transporter =
  SMTP_CONFIG?.auth?.user && SMTP_CONFIG?.auth?.pass
    ? nodemailer.createTransport(SMTP_CONFIG)
    : null

function createEmailBody(user, events, opportunities) {
  let body = `
    <html><body>
    <p>Hi ${user.firstName},</p>
    <p>Here is your personalized intelligence briefing:</p>
  `

  if (events.length > 0) {
    body += '<h2>New Synthesized Events</h2>'
    events.forEach((event) => {
      const flag = configStore.countryNameToFlagMap.get(event.country) || '🌍'
      body += `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
          <h3>${flag} ${event.synthesized_headline} [Score: ${event.highest_relevance_score}]</h3>
          <p><em>${event.synthesized_summary}</em></p>
          <p><strong>Source Articles:</strong></p>
          <ul>
            ${event.source_articles
              .map(
                (article) =>
                  `<li><a href="${article.link}">${article.headline}</a> (${article.newspaper})</li>`
              )
              .join('')}
          </ul>
        </div>
      `
    })
  }

  if (opportunities.length > 0) {
    body += '<h2>New Opportunities</h2>'
    opportunities.forEach((opp) => {
      const flag = configStore.countryNameToFlagMap.get(opp.basedIn) || '🌍'
      body += `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
          <h3>${flag} Contact: ${opp.reachOutTo} (~$${opp.likelyMMDollarWealth}M)</h3>
          <p><strong>Reason:</strong> ${opp.whyContact[0]}</p>
          <p>Based in: ${opp.basedIn}</p>
          ${
            opp.sourceArticleId
              ? `<p><a href="${opp.sourceArticleId.link}">View Source Article</a></p>`
              : ''
          }
        </div>
      `
    })
  }

  body += '</body></html>'
  return body
}

export async function sendBulkEmails(emailQueue) {
  if (!transporter) {
    logger.error('SMTP transport not configured. Cannot send emails.')
    return 0
  }
  if (emailQueue.length === 0) return 0

  logger.info(`Dispatching ${emailQueue.length} personalized emails...`)
  let successCount = 0

  for (const { user, events, opportunities } of emailQueue) {
    const subject = `New Intelligence: ${events.length} Events, ${opportunities.length} Opportunities`
    const htmlBody = createEmailBody(user, events, opportunities)

    const mailOptions = {
      from: `"${SMTP_CONFIG.fromName}" <${SMTP_CONFIG.fromAddress}>`,
      to: user.email,
      subject,
      html: htmlBody,
    }

    if (!IS_PRODUCTION && !FORCE_EMAIL_SEND_DEV) {
      logger.warn(`[DEV MODE] Skipping actual email send to: ${user.email}`)
      successCount++
      continue
    }

    try {
      await transporter.sendMail(mailOptions)
      logger.info(`✅ Email sent successfully to ${user.email}`)
      successCount++
    } catch (error) {
      logger.error({ err: error }, `❌ Failed to send email to ${user.email}`)
    }
  }

  return successCount
}
