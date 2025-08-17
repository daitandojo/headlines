// src/modules/scraper/index.js (version 3.3)
import * as cheerio from 'cheerio'
import pLimit from 'p-limit'
import playwright from 'playwright'
import { logger } from '../../utils/logger.js'
import { truncateString } from '../../utils/helpers.js'
import { CONCURRENCY_LIMIT, MIN_ARTICLE_CHARS } from '../../config/index.js'
import { COUNTRIES_CONFIG, TEXT_SELECTORS } from '../../config/sources.js'
import Subscriber from '../../../models/Subscriber.js'

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

export async function scrapeSite(browser, site) {
  const selectorUsed = site.useJsonLd ? 'JSON-LD' : site.selector
  logger.debug(
    { source: site.name, url: site.url, selector: selectorUsed },
    `Scraping initiated...`
  )

  const html = await fetchPage(browser, site.url)

  if (!html) return { source: site.name, articles: [], success: false }

  const $ = cheerio.load(html)
  let articles = []

  if (site.useJsonLd) {
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
                  link: new URL(url, site.url).href,
                  source: site.name,
                  newspaper: site.newspaper || site.name,
                  country: site.countryName,
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
    $(site.selector).each((_, el) => {
      const articleData = site.extract($(el), site)
      if (articleData && articleData.headline && articleData.link) {
        articleData.link = new URL(articleData.link, site.url).href
        articleData.newspaper = site.newspaper || site.name
        articleData.country = site.countryName
        articleData.headline_selector = selectorUsed
        articles.push(articleData)
      }
    })
  }

  const uniqueArticles = Array.from(new Map(articles.map((a) => [a.link, a])).values())
  return { source: site.name, articles: uniqueArticles, success: true }
}

export async function scrapeAllHeadlines() {
  logger.info(
    "📰 Determining which sources to scrape based on the 'included' flag in sources.js..."
  )

  const countriesToScrape = COUNTRIES_CONFIG.filter(
    (country) => country.included === true
  )

  if (countriesToScrape.length === 0) {
    logger.warn(
      "No countries are marked as 'included: true' in sources.js. Halting scraping."
    )
    return { allArticles: [], scraperHealth: [] }
  }

  logger.info(
    `Pipeline will now scrape sources from: [${countriesToScrape.map((c) => c.countryName).join(', ')}]`
  )

  const allSites = countriesToScrape.flatMap((country) =>
    country.sites.map((site) => ({ ...site, countryName: country.countryName }))
  )

  const allArticles = []
  const scraperHealth = []

  let browser = null
  try {
    logger.info('[Playwright] Launching shared browser instance for this run...')
    browser = await playwright.chromium.launch()

    const promises = allSites.map((site) =>
      limit(async () => {
        const result = await scrapeSite(browser, site)
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

  logger.info(
    `Scraping complete. Found a total of ${allArticles.length} headlines from included sources.`
  )
  return { allArticles, scraperHealth }
}

export async function scrapeArticleContent(article) {
  // This function is called individually, so it still needs its own browser instance.
  // The main headline scraper is where the performance gain is realized.
  let browser = null
  try {
    browser = await playwright.chromium.launch()
    const html = await fetchPage(browser, article.link)
    if (!html) return { ...article, enrichment_error: 'Failed to fetch page' }

    const $ = cheerio.load(html)
    let contentText = ''
    let extractedFrom = 'N/A'

    if (article.newspaper === 'Børsen') {
      const nextDataScript = $('script[id="__NEXT_DATA__"]').html()
      if (nextDataScript) {
        try {
          const jsonData = JSON.parse(nextDataScript)
          const articleBodyHtml = jsonData?.props?.pageProps?.article?.body
          if (articleBodyHtml) {
            const $article = cheerio.load(articleBodyHtml)
            contentText = $article.text().replace(/\s+/g, ' ').trim()
            extractedFrom = '__NEXT_DATA__'
          }
        } catch (e) {
          /* Ignore parsing errors */
        }
      }
      if (contentText.length >= MIN_ARTICLE_CHARS) {
        article.articleContent = { contents: [contentText] }
        logger.debug(
          {
            headline: truncateString(article.headline, 40),
            chars: contentText.length,
            selector: extractedFrom,
            snippet: `${contentText.substring(0, 100)}...`,
          },
          `✅ Børsen enrichment successful.`
        )
        return article
      }
    }

    if (article.newspaper === 'Finansavisen') {
      const nextDataScript = $('script[id="__NEXT_DATA__"]').html()
      if (nextDataScript) {
        try {
          const jsonData = JSON.parse(nextDataScript)
          const articleHtml = jsonData?.props?.pageProps?.article?.article?.body
          if (articleHtml) {
            const $article = cheerio.load(articleHtml)
            contentText = $article.text().replace(/\s+/g, ' ').trim()
            extractedFrom = '__NEXT_DATA__'
          }
        } catch (e) {
          /* Ignore parsing errors */
        }
      }
      if (contentText.length < MIN_ARTICLE_CHARS) {
        contentText =
          $('meta[name="description"]').attr('content')?.replace(/\s+/g, ' ').trim() || ''
        if (contentText.length > 0) extractedFrom = 'meta[description]'
      }

      if (contentText.length >= MIN_ARTICLE_CHARS) {
        article.articleContent = { contents: [contentText] }
        logger.debug(
          {
            headline: truncateString(article.headline, 40),
            chars: contentText.length,
            selector: extractedFrom,
            snippet: `${contentText.substring(0, 100)}...`,
          },
          `✅ Finansavisen enrichment successful.`
        )
        return article
      }
    }

    let selectors = TEXT_SELECTORS[article.newspaper]
    if (!selectors)
      return { ...article, enrichment_error: `No selector for "${article.newspaper}"` }
    if (!Array.isArray(selectors)) selectors = [selectors]

    let fullText = ''
    let winningSelector = 'N/A'

    for (const selector of selectors) {
      if (selector.startsWith('meta[')) {
        fullText = $(selector).attr('content')?.replace(/\s+/g, ' ').trim() || ''
      } else {
        fullText = $(selector).text().replace(/\s+/g, ' ').trim()
      }

      if (fullText.length >= MIN_ARTICLE_CHARS) {
        winningSelector = selector
        break
      }
    }

    if (fullText.length >= MIN_ARTICLE_CHARS) {
      article.articleContent = { contents: [fullText] }
      logger.debug(
        {
          headline: truncateString(article.headline, 40),
          chars: fullText.length,
          selector: winningSelector,
          snippet: `${fullText.substring(0, 100)}...`,
        },
        `✅ Enrichment successful.`
      )
    } else {
      article.enrichment_error = 'Content not found or too short'
      logger.warn(
        {
          headline: truncateString(article.headline, 60),
          newspaper: article.newspaper,
          chars: fullText.length,
          selectors_tried: selectors,
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
