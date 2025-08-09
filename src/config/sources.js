// src/config/sources.js
// Centralized configuration for web scraping sources, now grouped by country.

export const COUNTRIES_CONFIG = [
  {
    countryName: 'Denmark',
    flag: '🇩🇰',
    sites: [
      { key: 'berlingske', name: 'Berlingske', url: 'https://www.berlingske.dk/business', selector: 'h4.teaser__title a.teaser__title-link', extract: (el, site) => ({ headline: el.text().trim(), link: new URL(el.attr('href'), site.url).href, source: site.name, newspaper: site.name }) },
      { key: 'borsen_frontpage', name: 'Børsen Frontpage', newspaper: 'Børsen', url: 'https://borsen.dk/', useJsonLd: true },
      { key: 'borsen_nyheder', name: 'Børsen Nyheder', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder', useJsonLd: true },
      { key: 'borsen_finans', name: 'Børsen Finans', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/finans', useJsonLd: true },
      { key: 'borsen_virksomheder', name: 'Børsen Virksomheder', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/virksomheder', useJsonLd: true },
      { key: 'borsen_investor', name: 'Børsen Investor', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/investor', useJsonLd: true },
      { key: 'politiken', name: 'Politiken', url: 'https://politiken.dk/danmark/oekonomi/', selector: 'article', extract: (el, site) => { const h = el.find('h2, h3, h4').first().text().trim(); const a = el.find('a[href*="/art"]').first().attr('href'); return h && a ? { headline: h, link: new URL(a, site.url).href, source: site.name, newspaper: site.name } : null; } },
      { key: 'finans_dk', name: 'Finans.dk', url: 'https://finans.dk/seneste-nyt', selector: 'article a h3', extract: (el, site) => ({ headline: el.text().trim(), link: el.closest('a').attr('href'), source: site.name, newspaper: site.name }) },
      { key: 'axcel', name: 'Axcel', url: 'https://axcel.com/news', selector: 'div.news-mask a', extract: (el, site) => ({ headline: el.find('h3').text().trim(), link: new URL(el.attr('href'), site.url).href, source: site.name, newspaper: site.name }) },
      { key: 'polaris', name: 'Polaris', url: 'https://polarisequity.dk/news', selector: 'div.fl-post-feed-post', extract: (el, site) => { const linkEl = el.find('h3.fl-post-feed-title a'); const headline = linkEl.text().trim(); const href = linkEl.attr('href'); if (headline && href) { return { headline, link: new URL(href, site.url).href, source: site.name, newspaper: site.name }; } return null; } },
    ]
  },
  {
    countryName: 'Norway',
    flag: '🇳🇴',
    sites: [
      {
        key: 'finansavisen', name: 'Finansavisen', url: 'https://www.finansavisen.no/', newspaper: 'Finansavisen', selector: 'script',
        extract: (el, site) => { /* ... existing extraction logic ... */ }
      },
      { key: 'e24', name: 'E24', url: 'https://e24.no/', newspaper: 'E24', selector: 'a._teaser_bizto_1', extract: (el, site) => { const headlineEl = el.find('h3._mainTitle_qsmm2_16').clone(); headlineEl.find('style').remove(); const headline = headlineEl.text().trim(); const href = el.attr('href'); if (headline && href) { return { headline, link: new URL(href, site.url).href, source: site.name, newspaper: site.newspaper }; } return null; } },
      { key: 'fsn_capital', name: 'FSN Capital', url: 'https://fsncapital.com/en/news/', newspaper: 'FSN Capital', selector: 'div.newsitem', extract: (el, site) => { const linkEl = el.find('h4.title a'); return { headline: linkEl.text().trim(), link: linkEl.attr('href'), source: site.name, newspaper: site.newspaper, } } },
      { key: 'verdane', name: 'Verdane', url: 'https://verdane.com/portfolio/', newspaper: 'Verdane', selector: 'li.wp-block-post.portfolio', extract: (el, site) => { const linkEl = el.find('a.wp-block-klingit-the-product-block-link'); const companyName = linkEl.find('h3.wp-block-post-title').text().trim(); if (companyName) { return { headline: `Verdane invests in ${companyName}`, link: linkEl.attr('href'), source: site.name, newspaper: site.newspaper, }; } return null; } },
    ]
  },
  {
    countryName: 'Pan-Nordic',
    flag: '🇪🇺',
    sites: [
      { key: 'nordic_capital', name: 'Nordic Capital', url: 'https://www.nordiccapital.com/news-views/', newspaper: 'Nordic Capital', selector: 'article.masonry-card--component a', extract: (el, site) => { const headline = el.find('h3').text().trim(); const href = el.attr('href'); if (headline && href) { return { headline, link: new URL(href, site.url).href, source: site.name, newspaper: site.newspaper }; } return null; } },
      { key: 'altor', name: 'Altor', url: 'https://www.altor.com/news/', newspaper: 'Altor', selector: 'a.g-content-card.g-news__item', extract: (el, site) => ({ headline: el.find('p.g-content-card__header').text().trim(), link: new URL(el.attr('href'), site.url).href, source: site.name, newspaper: site.newspaper, }) },
    ]
  }
  // Add other countries like Finland, Netherlands, Belgium here...
];

// --- NEW: Create and export maps for use in the email module ---
export const newspaperToCountryMap = new Map();
export const countryNameToFlagMap = new Map();

COUNTRIES_CONFIG.forEach(country => {
  countryNameToFlagMap.set(country.countryName, country.flag);
  country.sites.forEach(site => {
    // A newspaper can appear in multiple site configs (e.g., Børsen), but will map to the same country.
    if (!newspaperToCountryMap.has(site.newspaper || site.name)) {
      newspaperToCountryMap.set(site.newspaper || site.name, country.countryName);
    }
  });
});


export const TEXT_SELECTORS = {
  'Berlingske': '.article-body p',
  'Børsen': [ '.article-content', 'meta[name="description"]' ],
  'Politiken': 'section#js-article-body .font-serif-body-20 p',
  'Finans.dk': 'p.container-text:not([class*="italic"])',
  'DN.no': '.dn-article-top .lead, .dn-content .dn-text p',
  'Axcel': 'div.article-content p',
  'Polaris': 'div.fl-module-fl-post-content p',
  'Finansavisen': [ '.c-article-regular__body__preamble, .c-article-regular__body p', 'meta[name="description"]' ],
  'Kapital': [ '.c-article-regular__body__preamble, .c-article-regular__body p', 'meta[name="description"]' ],
  'E24': 'article p[data-test-tag="lead-text"], article p.hyperion-css-1lemvax',
  'Nordic Capital': '.multi-column-rich-text--content-block .block-content p',
  'EQT': '.body-l-body-m p', 
  'FSN Capital': 'div.newspage__content p',
  'Altor': 'div.g-wysiwyg p',
  'Verdane': '.entry-content p',
};