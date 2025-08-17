// src/modules/email/components/supervisorEmailBodyBuilder.js (version 2.1)
// src/modules/email/components/supervisorEmailBodyBuilder.js
import {
  SUPERVISOR_EMAIL_CONFIG,
  HEADLINES_RELEVANCE_THRESHOLD,
} from '../../../config/index.js'
import { LOGO_CID } from '../constants.js' // <-- MODIFIED: Import LOGO_CID
import { truncateString } from '../../../utils/helpers.js'
import Article from '../../../../models/Article.js'
import SynthesizedEvent from '../../../../models/SynthesizedEvent.js'
import Opportunity from '../../../../models/Opportunity.js'

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createSupervisorEmailWrapper(bodyContent, subject) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; color: #212529; }
            .container { max-width: 1200px; margin: 20px auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1, h2, h3, h4 { margin-top: 0; margin-bottom: 1rem; font-weight: 600; color: #343a40; }
            h1 { font-size: 28px; }
            h2 { font-size: 22px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-top: 40px; }
            p { margin-top: 0; margin-bottom: 1rem; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #dee2e6; }
            th { background-color: #f1f3f5; font-weight: 600; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            tr:hover { background-color: #e9ecef; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .alert-box { border: 1px solid; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .alert-danger { background-color: #f8d7da; border-color: #f5c6cb; color: #721c24; }
            .alert-danger h2 { color: #721c24; }
            .card { border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 20px; background-color: #ffffff; }
            .card-header { padding: 15px; border-bottom: 1px solid #dee2e6; background-color: #f8f9fa; }
            .card-body { padding: 20px; }
            .status-success { color: #28a745; font-weight: bold; }
            .status-dropped { color: #dc3545; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">${bodyContent}</div>
    </body>
    </html>`
}

function createScraperFailureAlertHtml(enrichmentOutcomes) {
  if (!enrichmentOutcomes || enrichmentOutcomes.length === 0) return ''

  const scraperFailures = enrichmentOutcomes.filter(
    (item) =>
      item.outcome === 'Dropped' && item.assessment_article.includes('Enrichment Failed')
  )

  if (scraperFailures.length === 0) return ''

  let listItems = scraperFailures
    .map(
      (item) => `
        <li style="margin-bottom: 12px;">
            <strong>${escapeHtml(item.newspaper)}:</strong> 
            <a href="${item.link}" target="_blank">${escapeHtml(item.headline)}</a><br>
            <em style="font-size:13px; color: #555;">${escapeHtml(item.assessment_article)}</em>
        </li>
    `
    )
    .join('')

  return `
    <div class="alert-box alert-danger">
        <h2 style="margin-top:0;">⚠️ Scraper Action Required</h2>
        <p>The following relevant headlines failed the enrichment stage, likely due to an outdated or incorrect article text selector. Please review the selectors for these sources in <strong>src/config/sources.js</strong>.</p>
        <ul style="padding-left: 20px; margin-top: 15px; font-size: 14px;">${listItems}</ul>
    </div>`
}

function createScraperHealthTable(healthStats) {
  if (!healthStats || healthStats.length === 0)
    return '<h2>Scraper Health Check</h2><p>No health stats available.</p>'

  let tableRows = healthStats
    .sort((a, b) => a.source.localeCompare(b.source))
    .map((stat) => {
      const status = stat.success ? '✅ OK' : '❌ FAILED'
      const statusColor = stat.success ? '#28a745' : '#dc3545'
      return `
            <tr>
                <td>${escapeHtml(stat.source)}</td>
                <td style="color: ${statusColor}; font-weight: bold;">${status}</td>
                <td>${stat.count}</td>
            </tr>`
    })
    .join('')

  return `
    <h2>Scraper Health Check</h2>
    <table>
        <thead><tr><th>Source</th><th>Status</th><th>Articles Found</th></tr></thead>
        <tbody>${tableRows}</tbody>
    </table>`
}

function createEnrichmentFunnelHtml(enrichmentOutcomes) {
  if (!enrichmentOutcomes || enrichmentOutcomes.length === 0) {
    return `<h2>Enrichment Funnel</h2><p>No headlines were relevant enough for enrichment (scored &lt; ${HEADLINES_RELEVANCE_THRESHOLD}).</p>`
  }

  const cardsHtml = enrichmentOutcomes
    .sort((a, b) => {
      if (a.outcome === 'Success' && b.outcome !== 'Success') return -1
      if (a.outcome !== 'Success' && b.outcome === 'Success') return 1
      return (b.headlineScore || 0) - (a.headlineScore || 0)
    })
    .map((item) => {
      const isSuccess = item.outcome === 'Success'
      const statusClass = isSuccess ? 'status-success' : 'status-dropped'
      const statusIcon = isSuccess ? '✅' : '❌'

      return `
        <div class="card">
            <div class="card-header">
                <h4 style="margin:0; font-size: 16px;">
                    <a href="${item.link}" target="_blank">${escapeHtml(item.headline)}</a>
                </h4>
            </div>
            <div class="card-body">
                <p style="margin: 0 0 10px;"><strong>${statusIcon} Status:</strong> <span class="${statusClass}">${item.outcome}</span></p>
                <p style="margin: 0 0 5px; font-size: 13px; color: #495057;">
                    <strong>Stage 1 (Headline):</strong> Score [${item.headlineScore}] - <i>${escapeHtml(item.assessment_headline)}</i>
                </p>
                <p style="margin: 0 0 10px; font-size: 13px; color: #495057;">
                    <strong>Stage 2 (Content):</strong> Final Score [${item.finalScore ?? 'N/A'}] - <span style="font-style: italic;">${escapeHtml(item.assessment_article)}</span>
                </p>
                <div style="padding: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; color: #495057; max-height: 100px; overflow-y: auto;">
                    <strong>Article Snippet:</strong>
                    <p style="margin-top: 5px; margin-bottom: 0; white-space: pre-wrap; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;">${escapeHtml(item.content_snippet)}...</p>
                </div>
            </div>
        </div>`
    })
    .join('')

  return `<h2>Enrichment Funnel Audit Trail (Lifecycle of ${enrichmentOutcomes.length} relevant headlines)</h2>${cardsHtml}`
}

async function createEventsTableHtml(runStartDate) {
  const recentEvents = await SynthesizedEvent.find({ createdAt: { $gte: runStartDate } })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  if (recentEvents.length === 0)
    return `<h2>Synthesized Events from this Run</h2><p>No events were synthesized in this run.</p>`

  let tableRows = recentEvents
    .map(
      (event) => `
        <tr>
            <td>${truncateString(escapeHtml(event.synthesized_headline), 80)}</td>
            <td>${event.highest_relevance_score}</td>
            <td>${escapeHtml(event.source_articles.map((a) => a.newspaper).join(', '))}</td>
            <td>${escapeHtml(event.key_individuals.map((p) => p.name).join(', ') || 'N/A')}</td>
            <td>${event.emailed ? 'Yes' : 'No'}</td>
        </tr>
    `
    )
    .join('')

  return `
    <h2>Synthesized Events (${recentEvents.length})</h2>
    <table>
        <thead><tr><th>Synthesized Headline</th><th>Score</th><th>Sources</th><th>Key Individuals</th><th>Emailed?</th></tr></thead>
        <tbody>${tableRows}</tbody>
    </table>`
}

async function createArticlesTableHtml(runStartDate) {
  const freshArticles = await Article.find({ createdAt: { $gte: runStartDate } })
    .sort({ relevance_headline: -1 })
    .limit(500)
    .lean()
  if (freshArticles.length === 0)
    return `<h2>All Fresh Articles Processed</h2><p>No new raw articles were processed.</p>`

  const relevantFreshArticles = freshArticles.filter((a) => a.relevance_headline > 0)
  const irrelevantCount = freshArticles.length - relevantFreshArticles.length

  if (relevantFreshArticles.length === 0) {
    return `<h2>All Fresh Articles Processed (${freshArticles.length})</h2><p>No headlines were deemed relevant (all scored 0).</p>`
  }

  let tableRows = relevantFreshArticles
    .map((article) => {
      const status =
        article.relevance_headline >= HEADLINES_RELEVANCE_THRESHOLD
          ? 'Relevant for Enrichment'
          : 'Low Relevance'
      return `
            <tr>
                <td><a href="${article.link}" target="_blank">${truncateString(escapeHtml(article.headline), 80)}</a></td>
                <td>${escapeHtml(article.newspaper)}</td>
                <td>${article.relevance_headline}</td>
                <td>${status}</td>
            </tr>`
    })
    .join('')

  let footer = ''
  if (irrelevantCount > 0) {
    footer = `<p style="margin-top: 15px; font-size: 13px; color: #6c757d;">... plus ${irrelevantCount} other headlines that were deemed irrelevant (score 0).</p>`
  }

  return `
    <h2>All Fresh Articles Processed (${freshArticles.length})</h2>
    <table>
        <thead><tr><th>Headline</th><th>Source</th><th>HL Score</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
    </table>
    ${footer}`
}

export async function createSupervisorEmailBody(runStats) {
  const runTimestamp = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/Copenhagen',
  })
  const runStartDate = new Date(Date.now() - 10 * 60 * 1000) // Check for items created in the last 10 minutes

  const [newArticleCount, newEventCount, newOpportunityCount] = await Promise.all([
    Article.countDocuments({ createdAt: { $gte: runStartDate } }),
    SynthesizedEvent.countDocuments({ createdAt: { $gte: runStartDate } }),
    Opportunity.countDocuments({ createdAt: { $gte: runStartDate } }),
  ])

  let statsHtml = `<h2>Run Statistics</h2><ul>`
  const statOrder = [
    'headlinesScraped',
    'freshHeadlinesFound',
    'headlinesAssessed',
    'relevantHeadlines',
    'articlesEnriched',
    'relevantArticles',
  ]

  for (const key of statOrder) {
    if (runStats.hasOwnProperty(key)) {
      const value = runStats[key]
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
      statsHtml += `<li style="font-size: 15px; margin-bottom: 8px;"><strong>${formattedKey}:</strong> ${value}</li>`
    }
  }

  statsHtml += `<li style="font-size: 15px; margin-bottom: 8px; font-weight: bold; color: #0056b3;"><strong>New Articles Created:</strong> ${newArticleCount}</li>`
  statsHtml += `<li style="font-size: 15px; margin-bottom: 8px; font-weight: bold; color: #0056b3;"><strong>New Events Synthesized:</strong> ${newEventCount}</li>`
  statsHtml += `<li style="font-size: 15px; margin-bottom: 8px; font-weight: bold; color: #0056b3;"><strong>New Opportunities Generated:</strong> ${newOpportunityCount}</li>`
  statsHtml += `<li style="font-size: 15px; margin-bottom: 8px;"><strong>Events Emailed to Subscribers:</strong> ${runStats.eventsEmailed || 0}</li>`

  if (runStats.errors && runStats.errors.length > 0) {
    statsHtml += `<li style="font-size: 15px; margin-bottom: 8px; color: #721c24;"><strong>Errors:</strong> ${runStats.errors.join(', ')}</li>`
  }
  statsHtml += `</ul>`

  const scraperFailureAlertHtml = createScraperFailureAlertHtml(
    runStats.enrichmentOutcomes
  )
  const scraperHealthHtml = createScraperHealthTable(runStats.scraperHealth)
  const enrichmentFunnelHtml = createEnrichmentFunnelHtml(runStats.enrichmentOutcomes)

  const [eventsTableHtml, articlesTableHtml] = await Promise.all([
    createEventsTableHtml(runStartDate),
    createArticlesTableHtml(runStartDate),
  ])

  const bodyContent = `
        <div style="text-align:center; margin-bottom: 30px;">
            <img src="cid:${LOGO_CID}" alt="Logo" style="max-width:50px; filter: grayscale(1);">
            <h1>${SUPERVISOR_EMAIL_CONFIG.subject}</h1>
            <p style="font-size: 16px; color: #6c757d;">Run completed: ${runTimestamp}</p>
        </div>
        
        ${scraperFailureAlertHtml}
        ${statsHtml}
        ${enrichmentFunnelHtml}
        ${eventsTableHtml}
        ${articlesTableHtml}
        ${scraperHealthHtml}

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
            <p>This is an automated report from the ${SUPERVISOR_EMAIL_CONFIG.brandName}.</p>
        </div>
    `

  return createSupervisorEmailWrapper(bodyContent, SUPERVISOR_EMAIL_CONFIG.subject)
}
