// src/config/sources.js (version 1.0)
// Centralized configuration for web scraping sources.
// This separates the scraper's target configuration from its operational logic.

export const SITES_CONFIG = {
    berlingske: { name: 'Berlingske', url: 'https://www.berlingske.dk/business', selector: 'h4.teaser__title a.teaser__title-link', extract: (el, site) => ({ headline: el.text().trim(), link: new URL(el.attr('href'), site.url).href, source: site.name, newspaper: site.name }) },
    borsen: { name: 'Børsen', url: 'https://borsen.dk/nyheder', useJsonLd: true },
    politiken: { name: 'Politiken', url: 'https://politiken.dk/danmark/oekonomi/', selector: 'article', extract: (el, site) => { const h = el.find('h2, h3, h4').first().text().trim(); const a = el.find('a[href*="/art"]').first().attr('href'); return h && a ? { headline: h, link: new URL(a, site.url).href, source: site.name, newspaper: site.name } : null; } },
    finans: { name: 'Finans.dk', url: 'https://finans.dk/seneste-nyt', selector: 'article a h3', extract: (el, site) => ({ headline: el.text().trim(), link: el.closest('a').attr('href'), source: site.name, newspaper: site.name }) },
};

export const TEXT_SELECTORS = {
  'Berlingske': '.article-body p',
  'Børsen': '.article-content p',
  'Politiken': 'section[data-track-meta*="article-body"] p',
  'Finans.dk': 'p.container-text:not([class*="italic"])',
};