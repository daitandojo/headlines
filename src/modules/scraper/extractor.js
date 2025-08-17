// src/modules/scraper/extractors.js (version 1.0)
// This file contains a registry of custom data extraction functions for specific websites.

const simpleExtractor = (el, site) => {
  const headline = el.text().trim().replace(/\s+/g, ' ')
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.newspaper || site.name }
  }
  return null
}

const kapitalWatchExtractor = (el, site) => {
  const headline = el.find('h1').text().trim().replace(/\s+/g, ' ')
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const insideBusinessExtractor = (el, site) => {
  const headlineElement = el.find('h2 a')
  const headline = headlineElement.text().trim().replace(/\s+/g, ' ')
  const link = headlineElement.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.newspaper }
  }
  return null
}

const axcelExtractor = (el, site) => ({
  headline: el.find('h3').text().trim(),
  link: el.attr('href'),
  source: site.name,
  newspaper: site.name,
})

const polarisExtractor = (el, site) => {
  const linkEl = el.find('h3.fl-post-feed-title a')
  const headline = linkEl.text().trim()
  const href = linkEl.attr('href')
  if (headline && href) {
    return { headline, link: href, source: site.name, newspaper: site.name }
  }
  return null
}

const majInvestExtractor = (el, site) => {
  const headline = el.find('.news-list-item__title').text().trim()
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const groCapitalExtractor = (el, site) => {
  const headline = el.find('div[class^="heading-"]').text().trim().replace(/\s+/g, ' ')
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const eifoExtractor = (el, site) => {
  const headline = el.find('h4').text().trim()
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.newspaper }
  }
  return null
}

const byFoundersExtractor = (el, site) => {
  const companyName = el.find('h3').text().trim()
  const link = el.attr('href')
  if (companyName && link && !companyName.includes('byFounders')) {
    return {
      headline: `byFounders Investment: ${companyName}`,
      link,
      source: site.name,
      newspaper: site.name,
    }
  }
  return null
}

const clearwaterExtractor = (el, site) => {
  const headline = el.find('h3.transaction-list-page__resource-title').text().trim()
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.newspaper }
  }
  return null
}

const finansDkExtractor = (el, site) => ({
  headline: el.text().trim(),
  link: el.closest('a').attr('href'),
  source: site.name,
  newspaper: site.name,
})

const politikenExtractor = (el, site) => {
  const h = el.find('h2, h3, h4').first().text().trim()
  const a = el.find('a[href*="/art"]').first().attr('href')
  return h && a ? { headline: h, link: a, source: site.name, newspaper: site.name } : null
}

const e24Extractor = (el, site) => {
  const headlineEl = el.find('h3._mainTitle_qsmm2_16').clone()
  headlineEl.find('style').remove()
  const headline = headlineEl.text().trim()
  const href = el.attr('href')
  if (headline && href) {
    return { headline, link: href, source: site.name, newspaper: site.newspaper }
  }
  return null
}

const fsnCapitalExtractor = (el, site) => {
  const linkEl = el.find('h4.title a')
  return {
    headline: linkEl.text().trim(),
    link: linkEl.attr('href'),
    source: site.name,
    newspaper: site.newspaper,
  }
}

const verdaneExtractor = (el, site) => {
  const linkEl = el.find('a.wp-block-klingit-the-product-block-link')
  const companyName = linkEl.find('h3.wp-block-post-title').text().trim()
  if (companyName) {
    return {
      headline: `Verdane invests in ${companyName}`,
      link: linkEl.attr('href'),
      source: site.name,
      newspaper: site.newspaper,
    }
  }
  return null
}

const quoteNlExtractor = (el, site) => {
  const headline = el.find('h3[data-theme-key="custom-item-title"]').text().trim()
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const deVolkskrantExtractor = (el, site) => {
  const link = el.attr('href')
  const headline = el.find('h3, h4, h2').first().text().trim()
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const algemeenDagbladExtractor = (el, site) => {
  const headline = el.find('div.ankeiler__title').text().trim().replace(/\s+/g, ' ')
  const link = el.attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const egeriaExtractor = (el, site) => {
  const headline = el.find('.item-content h3').text().trim()
  const link = el.find('.item-footer a').attr('href')
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.name }
  }
  return null
}

const ikPartnersExtractor = (el, site) => ({
  headline: el.find('h3').text().trim(),
  link: el.attr('href'),
  source: site.name,
  newspaper: site.name,
})

const bridgepointExtractor = (el, site) => ({
  headline: el.find('h3').text().trim(),
  link: el.attr('href'),
  source: site.name,
  newspaper: site.name,
})

export const extractorRegistry = {
  simple: simpleExtractor,
  kapitalwatch: kapitalWatchExtractor,
  insidebusiness_ma: insideBusinessExtractor,
  insidebusiness_business: insideBusinessExtractor,
  axcel: axcelExtractor,
  polaris: polarisExtractor,
  maj_invest: majInvestExtractor,
  gro_capital: groCapitalExtractor,
  eifo_dk: eifoExtractor,
  byfounders: byFoundersExtractor,
  clearwater_dk: clearwaterExtractor,
  finans_dk: finansDkExtractor,
  politiken: politikenExtractor,
  e24: e24Extractor,
  fsn_capital: fsnCapitalExtractor,
  verdane: verdaneExtractor,
  quotenet_nl: quoteNlExtractor,
  de_volkskrant: deVolkskrantExtractor,
  trouw_nl: deVolkskrantExtractor, // Reuses de_volkskrant logic
  algemeen_dagblad: algemeenDagbladExtractor,
  egeria: egeriaExtractor,
  ik_partners_news: ikPartnersExtractor,
  bridgepoint_news: bridgepointExtractor,
}
