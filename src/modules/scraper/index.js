// src/modules/scraper/index.js (version 3.5)
import * as cheerio from 'cheerio'
import pLimit from 'p-limit'
import playwright from 'playwright'
import { logger } from '../../utils/logger.js'
import { truncateString } from '../../utils/helpers.js'
import { CONCURRENCY_LIMIT, MIN_ARTICLE_CHARS } from '../../config/index.js'
import { extractorRegistry } from './extractors.js'
import Source from '../../../models/Source.js'

const limit = pLimit(CONCURRENCY_LIMIT)

const BROWSER_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
}

async function fetchPage(browser, url) {
  let page
  try {
    const context = await browser.newContext({ userAgent: BROWSER_HEADERS['User-Agent'] })
    page = await context.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)

    const consentSelectors = [
      'button:has-text("Accept all")',
      'button:has-text("Godkend alle")',
      'button:has-text("Tillad alle")',
      'button:has-text("Accepteer alles")',
      'button:has-text("I accept")',
    ]

    for (const selector of consentSelectors) {
      try {
        const button = page.locator(selector).first()
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click({ timeout: 2000 })
          logger.debug(`Clicked consent button on ${url}`)
          await page.waitForTimeout(1000)
          break
        }
      } catch (e) {
        /* Ignore */
      }
    }

    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(500)

    return await page.content()
  } catch (error) {
    logger.error(`[Playwright] Fetch failed for ${url}: ${error.message.split('\n')[0]}`)
    return null
  } finally {
    if (page) await page.close()
  }
}

export async function scrapeSite(browser, source) {
  const selectorUsed =
    source.extractionMethod === 'json-ld' ? 'JSON-LD' : source.headlineSelector
  logger.debug(
    { source: source.name, url: source.sectionUrl, selector: selectorUsed },
    `Scraping initiated...`
  )

  const html = await fetchPage(browser, source.sectionUrl)

  if (!html) return { source: source.name, articles: [], success: false }

  const $ = cheerio.load(html)
  let articles = []

  const extractFunction =
    extractorRegistry[source.extractorKey] || extractorRegistry['simple']

  if (source.extractionMethod === 'json-ld') {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).html())
        const potentialLists = [jsonData, ...(jsonData['@graph'] || [])]
        potentialLists.forEach((list) => {
          const items = list?.itemListElement
          if (items && Array.isArray(items)) {
            items.forEach((item) => {
              const headline = item.name || item.item?.name
              const url = item.url || item.item?.url
              if (headline && url) {
                articles.push({
                  headline: headline.trim(),
                  link: new URL(url, source.sectionUrl).href,
                  source: source.name,
                  newspaper: source.name,
                  country: source.country,
                  headline_selector: selectorUsed,
                })
              }
            })
          }
        })
      } catch (e) {
        /* Ignore parsing errors */
      }
    })
  } else {
    $(source.headlineSelector).each((_, el) => {
      const articleData = extractFunction($(el), {
        name: source.name,
        newspaper: source.name,
      })
      if (articleData && articleData.headline && articleData.link) {
        articleData.link = new URL(articleData.link, source.sectionUrl).href
        articleData.newspaper = source.name
        articleData.country = source.country
        articleData.headline_selector = selectorUsed
        articles.push(articleData)
      }
    })
  }

  const uniqueArticles = Array.from(new Map(articles.map((a) => [a.link, a])).values())
  return { source: source.name, articles: uniqueArticles, success: true }
}

export async function scrapeAllHeadlines() {
  logger.info('📰 Fetching active sources from database to begin scraping...')
  const sourcesToScrape = await Source.find({ status: 'active' }).lean()

  if (sourcesToScrape.length === 0) {
    logger.warn('No active sources found in the database. Halting scraping.')
    return { allArticles: [], scraperHealth: [] }
  }

  logger.info(`Pipeline will now scrape ${sourcesToScrape.length} active sources.`)

  const allArticles = []
  const scraperHealth = []

  let browser = null
  try {
    logger.info('[Playwright] Launching shared browser instance for this run...')
    browser = await playwright.chromium.launch()

    const promises = sourcesToScrape.map((source) =>
      limit(async () => {
        const result = await scrapeSite(browser, source)
        if (result.articles.length === 0) {
          logger.warn(`Scraped 0 unique headlines from ${result.source}.`)
        } else {
          logger.info(
            `Scraped ${result.articles.length} unique headlines from ${result.source}.`
          )
        }
        allArticles.push(...result.articles)
        scraperHealth.push({
          source: result.source,
          success: result.articles.length > 0,
          count: result.articles.length,
        })
        await Source.updateOne(
          { _id: source._id },
          {
            $set: {
              lastScrapedAt: new Date(),
              ...(result.success && { lastSuccessAt: new Date() }),
            },
          }
        )
      })
    )
    await Promise.all(promises)
  } catch (error) {
    logger.fatal({ err: error }, 'A critical error occurred during the scraping stage.')
  } finally {
    if (browser) {
      logger.info('[Playwright] Closing shared browser instance.')
      await browser.close()
    }
  }

  logger.info(`Scraping complete. Found a total of ${allArticles.length} headlines.`)
  return { allArticles, scraperHealth }
}

export async function scrapeArticleContent(article, source) {
  let browser = null
  try {
    browser = await playwright.chromium.launch()
    const html = await fetchPage(browser, article.link)
    if (!html) return { ...article, enrichment_error: 'Failed to fetch page' }

    const $ = cheerio.load(html)
    let contentText = ''

    // Image URL Extraction
    if (source && source.imageUrlSelector) {
      let imageUrl = $(source.imageUrlSelector).first().attr('src')
      if (imageUrl) {
        article.imageUrl = new URL(imageUrl, source.baseUrl).href
      }
    }

    // Special Handlers
    if (article.newspaper === 'Børsen') {
      const nextDataScript = $('script[id="__NEXT_DATA__"]').html()
      if (nextDataScript) {
        try {
          const jsonData = JSON.parse(nextDataScript)
          const articleBodyHtml = jsonData?.props?.pageProps?.article?.body
          if (articleBodyHtml) {
            contentText = cheerio.load(articleBodyHtml).text().replace(/\s+/g, ' ').trim()
          }
        } catch (e) {
          /* Ignore */
        }
      }
    }

    if (article.newspaper === 'Finansavisen') {
      const nextDataScript = $('script[id="__NEXT_DATA__"]').html()
      if (nextDataScript) {
        try {
          const jsonData = JSON.parse(nextDataScript)
          contentText = jsonData?.props?.pageProps?.article?.article?.body
            ? cheerio
                .load(jsonData.props.pageProps.article.article.body)
                .text()
                .replace(/\s+/g, ' ')
                .trim()
            : ''
        } catch (e) {
          /* Ignore */
        }
      }
      if (contentText.length < MIN_ARTICLE_CHARS) {
        contentText =
          $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim() || ''
      }
    }

    // Generic Selector Logic
    if (contentText.length < MIN_ARTICLE_CHARS && source && source.articleSelector) {
      const selectors = source.articleSelector.split(',').map((s) => s.trim())
      for (const selector of selectors) {
        if (selector.startsWith('meta[')) {
          contentText = $(selector).attr('content')?.replace(/\s+/g, ' ').trim() || ''
        } else {
          contentText = $(selector).text().replace(/\s+/g, ' ').trim()
        }
        if (contentText.length >= MIN_ARTICLE_CHARS) {
          break
        }
      }
    }

    if (contentText.length >= MIN_ARTICLE_CHARS) {
      article.articleContent = { contents: [contentText] }
      logger.debug(
        {
          headline: truncateString(article.headline, 40),
          chars: contentText.length,
          imageUrl: article.imageUrl,
          snippet: `${contentText.substring(0, 100)}...`,
        },
        `✅ Enrichment successful.`
      )
    } else {
      article.enrichment_error = 'Content not found or too short'
      logger.warn(
        {
          headline: truncateString(article.headline, 60),
          newspaper: article.newspaper,
          chars: contentText.length,
          selectors_tried: source?.articleSelector || 'N/A',
          link: article.link,
        },
        `❌ Enrichment failed.`
      )
    }
    return article
  } finally {
    if (browser) await browser.close()
  }
}
