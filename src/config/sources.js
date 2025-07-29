// src/config/sources.js
// Centralized configuration for web scraping sources.
// This separates the scraper's target configuration from its operational logic.

export const SITES_CONFIG = {
    berlingske: { name: 'Berlingske', url: 'https://www.berlingske.dk/business', selector: 'h4.teaser__title a.teaser__title-link', extract: (el, site) => ({ headline: el.text().trim(), link: new URL(el.attr('href'), site.url).href, source: site.name, newspaper: site.name }) },
    borsen: { name: 'Børsen', url: 'https://borsen.dk/nyheder', useJsonLd: true },
    politiken: { name: 'Politiken', url: 'https://politiken.dk/danmark/oekonomi/', selector: 'article', extract: (el, site) => { const h = el.find('h2, h3, h4').first().text().trim(); const a = el.find('a[href*="/art"]').first().attr('href'); return h && a ? { headline: h, link: new URL(a, site.url).href, source: site.name, newspaper: site.name } : null; } },
    finans: { name: 'Finans.dk', url: 'https://finans.dk/seneste-nyt', selector: 'article a h3', extract: (el, site) => ({ headline: el.text().trim(), link: el.closest('a').attr('href'), source: site.name, newspaper: site.name }) },
    
    // MODIFIED: Removing DN Investor as it is un-scrapable with the current method (JS-driven, no href links).
    // dn_investor: {
    //     name: 'DN Investor',
    //     url: 'https://www.dn.no/investor',
    //     newspaper: 'DN.no',
    //     ...
    // },

    axcel: {
        name: 'Axcel',
        url: 'https://axcel.com/news',
        selector: 'div.news-mask a',
        extract: (el, site) => ({
            headline: el.find('h3').text().trim(),
            link: new URL(el.attr('href'), site.url).href,
            source: site.name,
            newspaper: site.name
        })
    },
    polaris: {
        name: 'Polaris',
        url: 'https://polarisequity.dk/news',
        selector: 'div.fl-post-feed-post',
        extract: (el, site) => {
            const linkEl = el.find('h3.fl-post-feed-title a');
            const headline = linkEl.text().trim();
            const href = linkEl.attr('href');
            if (headline && href) {
                return { headline, link: new URL(href, site.url).href, source: site.name, newspaper: site.name };
            }
            return null;
        }
    },
    finansavisen: {
        name: 'Finansavisen',
        url: 'https://www.finansavisen.no/',
        newspaper: 'Finansavisen',
        selector: 'article.dre-item a.dre-item__title',
        extract: (el, site) => ({
            headline: el.text().trim(),
            link: new URL(el.attr('href'), site.url).href,
            source: site.name,
            newspaper: site.newspaper
        })
    },
    finansavisen_kapital: {
        name: 'Finansavisen Kapital',
        url: 'https://www.finansavisen.no/kapital',
        newspaper: 'Kapital',
        selector: 'article.dre-item a.dre-item__title',
        extract: (el, site) => ({
            headline: el.text().trim(),
            link: new URL(el.attr('href'), site.url).href,
            source: site.name,
            newspaper: site.newspaper
        })
    },
    e24: {
        name: 'E24',
        url: 'https://e24.no/',
        newspaper: 'E24',
        selector: 'a._teaser_bizto_1',
        extract: (el, site) => {
            const headlineEl = el.find('h3._mainTitle_qsmm2_16').clone();
            headlineEl.find('style').remove();
            const headline = headlineEl.text().trim();
            const href = el.attr('href');
            if (headline && href) {
                return { headline, link: new URL(href, site.url).href, source: site.name, newspaper: site.newspaper };
            }
            return null;
        }
    },
    nordic_capital: {
        name: 'Nordic Capital',
        url: 'https://www.nordiccapital.com/news-views/',
        newspaper: 'Nordic Capital',
        selector: 'article.masonry-card--component a',
        extract: (el, site) => {
            const headline = el.find('h3').text().trim();
            const href = el.attr('href');
            if (headline && href) {
                return {
                    headline,
                    link: new URL(href, site.url).href,
                    source: site.name,
                    newspaper: site.newspaper
                };
            }
            return null;
        }
    },
    // --- PRIVATE EQUITY FIRMS ---
    eqt: {
        name: 'EQT',
        url: 'https://eqtgroup.com/news',
        newspaper: 'EQT',
    },
    fsn_capital: {
        name: 'FSN Capital',
        url: 'https://fsncapital.com/en/news/',
        newspaper: 'FSN Capital',
        selector: 'div.newsitem',
        extract: (el, site) => {
            const linkEl = el.find('h4.title a');
            return {
                headline: linkEl.text().trim(),
                link: linkEl.attr('href'),
                source: site.name,
                newspaper: site.newspaper,
            }
        },
    },
    altor: {
        name: 'Altor',
        url: 'https://www.altor.com/news/',
        newspaper: 'Altor',
        selector: 'a.g-content-card.g-news__item',
        extract: (el, site) => ({
            headline: el.find('p.g-content-card__header').text().trim(),
            link: new URL(el.attr('href'), site.url).href,
            source: site.name,
            newspaper: site.newspaper,
        }),
    },
    verdane: {
        name: 'Verdane',
        url: 'https://verdane.com/portfolio/',
        newspaper: 'Verdane',
        selector: 'li.wp-block-post.portfolio',
        extract: (el, site) => {
            const linkEl = el.find('a.wp-block-klingit-the-product-block-link');
            const companyName = linkEl.find('h3.wp-block-post-title').text().trim();
            if (companyName) {
                return {
                    headline: `Verdane invests in ${companyName}`,
                    link: linkEl.attr('href'),
                    source: site.name,
                    newspaper: site.newspaper,
                };
            }
            return null;
        },
    },
};

export const TEXT_SELECTORS = {
  'Berlingske': '.article-body p',
  'Børsen': '.article-content',
  'Politiken': 'section#js-article-body .font-serif-body-20 p',
  'Finans.dk': 'p.container-text:not([class*="italic"])',
  'DN.no': '.dn-article-top .lead, .dn-content .dn-text p',
  'Axcel': 'div.article-content p',
  'Polaris': 'div.fl-module-fl-post-content p',
  'Finansavisen': '.c-article-regular__body__preamble, .c-article-regular__body p',
  'Kapital': '.c-article-regular__body__preamble, .c-article-regular__body p',
  'E24': 'article p[data-test-tag="lead-text"], article p.hyperion-css-1lemvax',
  'Nordic Capital': '.multi-column-rich-text--content-block .block-content p',
  'EQT': '.body-l-body-m p', 
  'FSN Capital': 'div.newspage__content p',
  'Altor': 'div.g-wysiwyg p',
  'Verdane': '.entry-content p',
};