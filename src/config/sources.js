// src/config/sources.js (version 2.0)
// Centralized configuration for web scraping sources, now grouped by country.

/**
 * A simple, generic extractor for sites where the selector targets the <a> tag directly.
 * It grabs the text as the headline and the href as the link.
 * @param {cheerio.Element} el - The cheerio-wrapped element.
 * @param {object} site - The site configuration object.
 * @returns {object|null} An object with headline and link, or null.
 */
const simpleExtractor = (el, site) => {
  const headline = el.text().trim().replace(/\s+/g, ' ');
  const link = el.attr('href');
  if (headline && link) {
    return { headline, link, source: site.name, newspaper: site.newspaper || site.name };
  }
  return null;
};

export const COUNTRIES_CONFIG = [
  // --- Denmark ---
  {
    countryName: 'Denmark',
    flag: '🇩🇰',
    sites: [
      { key: 'berlingske', name: 'Berlingske', url: 'https://www.berlingske.dk/business', selector: 'h4.teaser__title a.teaser__title-link', extract: (el, site) => ({ headline: el.text().trim(), link: el.attr('href'), source: site.name, newspaper: site.name }), technology: 'axios' },
      { key: 'borsen_frontpage', name: 'Børsen Frontpage', newspaper: 'Børsen', url: 'https://borsen.dk/', useJsonLd: true, technology: 'axios' },
      { key: 'borsen_nyheder', name: 'Børsen Nyheder', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder', useJsonLd: true, technology: 'axios' },
      { key: 'borsen_finans', name: 'Børsen Finans', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/finans', useJsonLd: true, technology: 'axios' },
      { key: 'borsen_virksomheder', name: 'Børsen Virksomheder', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/virksomheder', useJsonLd: true, technology: 'axios' },
      { key: 'borsen_investor', name: 'Børsen Investor', newspaper: 'Børsen', url: 'https://borsen.dk/nyheder/investor', useJsonLd: true, technology: 'axios' },
      { key: 'politiken', name: 'Politiken', url: 'https://politiken.dk/danmark/oekonomi/', selector: 'article', extract: (el, site) => { const h = el.find('h2, h3, h4').first().text().trim(); const a = el.find('a[href*="/art"]').first().attr('href'); return h && a ? { headline: h, link: a, source: site.name, newspaper: site.name } : null; }, technology: 'axios' },
      { key: 'finans_dk', name: 'Finans.dk', url: 'https://finans.dk/seneste-nyt', selector: 'article a h3', extract: (el, site) => ({ headline: el.text().trim(), link: el.closest('a').attr('href'), source: site.name, newspaper: site.name }), technology: 'axios' },
      { key: 'axcel', name: 'Axcel', url: 'https://axcel.com/news', selector: 'div.news-mask a', extract: (el, site) => ({ headline: el.find('h3').text().trim(), link: el.attr('href'), source: site.name, newspaper: site.name }), technology: 'axios' },
      { key: 'polaris', name: 'Polaris', url: 'https://polarisequity.dk/news', selector: 'div.fl-post-feed-post', extract: (el, site) => { const linkEl = el.find('h3.fl-post-feed-title a'); const headline = linkEl.text().trim(); const href = linkEl.attr('href'); if (headline && href) { return { headline, link: href, source: site.name, newspaper: site.name }; } return null; }, technology: 'axios' },
    ]
  },
  // --- Norway ---
  {
    countryName: 'Norway',
    flag: '🇳🇴',
    sites: [
      { key: 'finansavisen', name: 'Finansavisen', url: 'https://www.finansavisen.no', newspaper: 'Finansavisen', selector: "a.block, .dre-item__title, .c-teaser__content__title__link, a[data-content]", extract: simpleExtractor, technology: 'playwright' },
      { key: 'e24', name: 'E24', url: 'https://e24.no/', newspaper: 'E24', selector: 'a._teaser_bizto_1', extract: (el, site) => { const headlineEl = el.find('h3._mainTitle_qsmm2_16').clone(); headlineEl.find('style').remove(); const headline = headlineEl.text().trim(); const href = el.attr('href'); if (headline && href) { return { headline, link: href, source: site.name, newspaper: site.newspaper }; } return null; }, technology: 'playwright' },
      { key: 'fsn_capital', name: 'FSN Capital', url: 'https://fsncapital.com/en/news/', newspaper: 'FSN Capital', selector: 'div.newsitem', extract: (el, site) => { const linkEl = el.find('h4.title a'); return { headline: linkEl.text().trim(), link: linkEl.attr('href'), source: site.name, newspaper: site.newspaper, } }, technology: 'axios' },
      { key: 'verdane', name: 'Verdane', url: 'https://verdane.com/portfolio/', newspaper: 'Verdane', selector: 'li.wp-block-post.portfolio', extract: (el, site) => { const linkEl = el.find('a.wp-block-klingit-the-product-block-link'); const companyName = linkEl.find('h3.wp-block-post-title').text().trim(); if (companyName) { return { headline: `Verdane invests in ${companyName}`, link: linkEl.attr('href'), source: site.name, newspaper: site.newspaper, }; } return null; }, technology: 'axios' },
      { key: 'dagens_naeringsliv', name: 'Dagens Næringsliv', url: 'https://www.dn.no', newspaper: 'Dagens Næringsliv', selector: "a.dn-link[href^='/'], a.dn-link[href*='dn.no/video'], a.dn-link[href*='/2-1-']", extract: simpleExtractor, technology: 'playwright' },
      { key: 'nrk_okonomi', name: 'NRK', url: 'https://www.nrk.no/nyheter/okonomi/', newspaper: 'NRK', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
      { key: 'aftenposten_okonomi', name: 'Aftenposten', url: 'https://www.aftenposten.no/okonomi/', newspaper: 'Aftenposten', selector: "a.teaser-link", extract: simpleExtractor, technology: 'playwright' },
      { key: 'nettavisen_okonomi', name: 'Nettavisen', url: 'https://www.nettavisen.no/okonomi/', newspaper: 'Nettavisen', selector: "article .teaser_body a, .teaser_body a, a.teaser_body", extract: simpleExtractor, technology: 'playwright' },
      { key: 'tv2_okonomi', name: 'TV 2', url: 'https://www.tv2.no/nyheter/okonomi/', newspaper: 'TV 2', selector: "a.article__link", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
   // --- Sweden ---
  {
    countryName: 'Sweden',
    flag: '🇸🇪',
    sites: [
        { key: 'dagens_industri', name: 'Dagens Industri', url: 'https://www.di.se', newspaper: 'Dagens Industri', selector: "a[href^=\"/nyheter/\"], a[href^=\"/live/\"], a[href^=\"/analys/\"], a[href^=\"/digital/\"], .js_watch-teaser, a.panorama-content__item", extract: simpleExtractor, technology: 'playwright' },
        { key: 'svenska_dagbladet', name: 'Svenska Dagbladet', url: 'https://www.svd.se/', newspaper: 'Svenska Dagbladet', selector: "a[class*=\"TeaserLink\"], a[class*=\"CarouselEntry\"], article h2 a, article h3 a, a[href^=\"/a/\"]", extract: simpleExtractor, technology: 'playwright' },
        { key: 'dagens_nyheter', name: 'Dagens Nyheter', url: 'https://www.dn.se/ekonomi/', newspaper: 'Dagens Nyheter', selector: ".ds-teaser a, a.ds-teaser", extract: simpleExtractor, technology: 'playwright' },
        { key: 'breakit', name: 'Breakit', url: 'https://www.breakit.se', newspaper: 'Breakit', selector: "a[href*='/artikel/'], a.ArticleLarge_article_large__link__Hce3q, .Entries_link__eHglX, .NewsWidget_article__UVMN7", extract: simpleExtractor, technology: 'playwright' },
        { key: 'efn_ekonomikanalen', name: 'EFN Ekonomikanalen', url: 'https://www.efn.se', newspaper: 'EFN Ekonomikanalen', selector: "a.group, a.block, a.flex, a.relative", extract: simpleExtractor, technology: 'playwright' },
        { key: 'svt_nyheter', name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/ekonomi', newspaper: 'SVT Nyheter', selector: "a[href^=\"/nyheter/ekonomi/\"]", extract: simpleExtractor, technology: 'playwright' },
        { key: 'affarsvarlden', name: 'Affärsvärlden', url: 'https://www.affarsvarlden.se', newspaper: 'Affärsvärlden', selector: "a.article-text-content__heading__link, .frontpage-main-article__related-articles-links__link, .sidebar-news__list_li__link, article h2 a, article h3 a", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Finland ---
  {
    countryName: 'Finland',
    flag: '🇫🇮',
    sites: [
      { key: 'talouselama', name: 'Talouselämä', url: 'https://www.talouselama.fi', newspaper: 'Talouselämä', selector: "a[href^='/uutiset/a/']", extract: simpleExtractor, technology: 'playwright' },
      { key: 'kauppalehti', name: 'Kauppalehti', url: 'https://www.kauppalehti.fi/uutiset/talous', newspaper: 'Kauppalehti', selector: "a[href*=\"/uutiset/a/\"]", extract: simpleExtractor, technology: 'playwright' },
      { key: 'helsingin_sanomat', name: 'Helsingin Sanomat', url: 'https://www.hs.fi/talous/', newspaper: 'Helsingin Sanomat', selector: "a.block", extract: simpleExtractor, technology: 'playwright' },
      { key: 'iltalehti', name: 'Iltalehti', url: 'https://www.iltalehti.fi/talous/', newspaper: 'Iltalehti', selector: "a.latest-pala, a.news-ticker-item, .half-article-content a, .half-article-content", extract: simpleExtractor, technology: 'playwright' },
      { key: 'taloussanomat_ilta_sanomat', name: 'Taloussanomat (Ilta-Sanomat)', url: 'https://www.is.fi/taloussanomat/', newspaper: 'Taloussanomat (Ilta-Sanomat)', selector: "a.block[href^=\"/taloussanomat/\"], a[href^=\"/autot/\"]", extract: simpleExtractor, technology: 'playwright' },
      { key: 'yle', name: 'Yle', url: 'https://yle.fi/uutiset/18-190125', newspaper: 'Yle', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
      { key: 'mtv_uutiset', name: 'MTV Uutiset', url: 'https://www.mtvuutiset.fi/aihe/uutiset/2309200', newspaper: 'MTV Uutiset', selector: "a[href^='/artikkeli/']", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Netherlands ---
  {
    countryName: 'Netherlands',
    flag: '🇳🇱',
    sites: [
        { key: 'fd_nl', name: 'Het Financieele Dagblad (FD.nl)', url: 'https://fd.nl/', newspaper: 'Het Financieele Dagblad (FD.nl)', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'de_telegraaf_dft', name: 'De Telegraaf – DFT', url: 'https://www.telegraaf.nl/financieel', newspaper: 'De Telegraaf – DFT', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'business_insider_nederland', name: 'Business Insider Nederland', url: 'https://www.businessinsider.nl/category/finance/', newspaper: 'Business Insider Nederland', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'quotenet_nl', name: 'Quote.nl', url: 'https://www.quotenet.nl/financien/', newspaper: 'Quote.nl', useJsonLd: true, technology: 'playwright' },
        { key: 'iex_nl', name: 'IEX.nl', url: 'https://www.iex.nl/nieuws/default.aspx', newspaper: 'IEX.nl', selector: "h3 a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'nrc_handelsblad', name: 'NRC Handelsblad', url: 'https://www.nrc.nl/nieuws/', newspaper: 'NRC Handelsblad', selector: "div[class*=\"teaser\"] a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'de_volkskrant', name: 'De Volkskrant', url: 'https://www.volkskrant.nl/economie/', newspaper: 'De Volkskrant', useJsonLd: true, technology: 'playwright' },
        { key: 'trouw_nl', name: 'Trouw.nl', url: 'https://www.trouw.nl/economie/', newspaper: 'Trouw.nl', useJsonLd: true, technology: 'playwright' },
        { key: 'algemeen_dagblad', name: 'Algemeen Dagblad (ad.nl)', url: 'https://www.ad.nl/economie/', newspaper: 'Algemeen Dagblad (ad.nl)', useJsonLd: true, technology: 'playwright' },
        { key: 'sprout_nl', name: 'Sprout.nl', url: 'https://www.sprout.nl', newspaper: 'Sprout.nl', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'mtsprout_nl', name: 'MT/Sprout', url: 'https://mtsprout.nl', newspaper: 'MT/Sprout', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'follow_the_money', name: 'Follow the Money (ftm.nl)', url: 'https://www.ftm.nl', newspaper: 'Follow the Money (ftm.nl)', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'pensioen_pro', name: 'Pensioen Pro', url: 'https://pensioenpro.nl', newspaper: 'Pensioen Pro', selector: "a.absolute-link[href*='pensioenpro.nl']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'vastgoedmarkt_nl', name: 'Vastgoedmarkt.nl', url: 'https://www.vastgoedmarkt.nl/nieuws', newspaper: 'Vastgoedmarkt.nl', selector: "article a.summary", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Spain ---
  {
    countryName: 'Spain',
    flag: '🇪🇸',
    sites: [
        { key: 'cinco_dias', name: 'Cinco Días', url: 'https://cincodias.elpais.com', newspaper: 'Cinco Días', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'expansion', name: 'Expansión', url: 'https://www.expansion.com/economia.html', newspaper: 'Expansión', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'el_economista', name: 'El Economista', url: 'https://www.eleconomista.es/economia/', newspaper: 'El Economista', selector: "h2 a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'la_informacion', name: 'La Información', url: 'https://www.lainformacion.com/economia/', newspaper: 'La Información', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'el_confidencial', name: 'El Confidencial', url: 'https://www.elconfidencial.com/economia/', newspaper: 'El Confidencial', selector: "div[class*=\"title\"] a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'abc', name: 'ABC', url: 'https://www.abc.es/economia/', newspaper: 'ABC', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'el_pais', name: 'El País', url: 'https://elpais.com/economia/', newspaper: 'El País', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'la_vanguardia', name: 'La Vanguardia', url: 'https://www.lavanguardia.com/economia', newspaper: 'La Vanguardia', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'vozpopuli', name: 'Vozpópuli', url: 'https://www.vozpopuli.com/economia-y-finanzas/', newspaper: 'Vozpópuli', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'invertia', name: 'Invertia', url: 'https://www.invertia.com', newspaper: 'Invertia', selector: "main a[href^='/invertia/'], main a[href^='/espana/'], main a[href^='/mundo/']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'capital_es', name: 'Capital.es', url: 'https://www.capital.es', newspaper: 'Capital.es', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- France ---
  {
    countryName: 'France',
    flag: '🇫🇷',
    sites: [
        { key: 'les_echos', name: 'Les Echos', url: 'https://www.lesechos.fr/economie', newspaper: 'Les Echos', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'le_figaro', name: 'Le Figaro', url: 'https://www.lefigaro.fr/economie', newspaper: 'Le Figaro', useJsonLd: true, technology: 'playwright' },
        { key: 'la_tribune', name: 'La Tribune', url: 'https://www.latribune.fr/actualites/economie/economie.html', newspaper: 'La Tribune', selector: "div[class*=\"title\"] a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'capital_fr', name: 'Capital', url: 'https://www.capital.fr/economie-politique', newspaper: 'Capital', selector: "a.articleCard, a.orderedContentList-link, .articleCard > a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'bfm_business', name: 'BFM Business', url: 'https://www.bfmtv.com/economie/', newspaper: 'BFM Business', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'challenges', name: 'Challenges', url: 'https://www.challenges.fr/economie/', newspaper: 'Challenges', selector: "a.ui-clickable[href^='/'][href*='_'], .domain-ui-category-latest__article a, .domain-ui-category-latest__primary-article", extract: simpleExtractor, technology: 'playwright' },
        { key: 'le_monde', name: 'Le Monde', url: 'https://www.lemonde.fr/economie/', newspaper: 'Le Monde', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'france_info', name: 'France Info', url: 'https://www.francetvinfo.fr/economie/', newspaper: 'France Info', selector: "article a[href]:not([href^='#']):not([rel~='nofollow'])", extract: simpleExtractor, technology: 'playwright' },
        { key: 'l_opinion', name: 'L\'Opinion', url: 'https://www.lopinion.fr/economie', newspaper: 'L\'Opinion', selector: "main a.Link, main a[id^='cXLink'], main article a:not(.Tag):not(.ButtonLink)", extract: simpleExtractor, technology: 'playwright' },
        { key: 'l_independant', name: 'L\'Indépendant', url: 'https://www.lindependant.fr/economie/', newspaper: 'L\'Indépendant', selector: "a.stretched-link, .article-childs__title", extract: simpleExtractor, technology: 'playwright' },
        { key: 'l_usine_nouvelle', name: 'L\'Usine Nouvelle', url: 'https://www.usinenouvelle.com/economie/', newspaper: 'L\'Usine Nouvelle', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- United Kingdom ---
  {
    countryName: 'United Kingdom',
    flag: '🇬🇧',
    sites: [
        { key: 'financial_times', name: 'Financial Times', url: 'https://www.ft.com', newspaper: 'Financial Times', selector: "article a.link", extract: simpleExtractor, technology: 'playwright' },
        { key: 'bloomberg', name: 'Bloomberg', url: 'https://www.bloomberg.com/europe', newspaper: 'Bloomberg', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'the_economist', name: 'The Economist', url: 'https://www.economist.com/finance-and-economics', newspaper: 'The Economist', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'bbc_news', name: 'BBC News', url: 'https://www.bbc.com/news/business', newspaper: 'BBC News', selector: "a.sc-8a623a54-0[href^='/news/articles/'], a.sc-8a623a54-0[href^='/news/live/']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'the_guardian', name: 'The Guardian', url: 'https://www.theguardian.com/uk/business', newspaper: 'The Guardian', selector: "article h3 a, article h2 a, a.dcr-1ij2qgb, a.dcr-dqajlz, a[href^='/'][class^='dcr-']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'the_telegraph', name: 'The Telegraph', url: 'https://www.telegraph.co.uk/business/', newspaper: 'The Telegraph', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'the_times', name: 'The Times', url: 'https://www.thetimes.co.uk/business', newspaper: 'The Times', selector: "a[href*=\"/article/\"], .article-headline", extract: simpleExtractor, technology: 'playwright' },
        { key: 'city_a_m', name: 'City A.M.', url: 'https://www.cityam.com', newspaper: 'City A.M.', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'investors_chronicle', name: 'Investors\' Chronicle', url: 'https://www.investorschronicle.co.uk', newspaper: 'Investors\' Chronicle', selector: "a.specialist__card__article--link, a.sc-laNGHT, a[href*='/content/']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'this_is_money', name: 'This is Money', url: 'https://www.thisismoney.co.uk', newspaper: 'This is Money', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Germany ---
  {
    countryName: 'Germany',
    flag: '🇩🇪',
    sites: [
        { key: 'handelsblatt', name: 'Handelsblatt', url: 'https://www.handelsblatt.com', newspaper: 'Handelsblatt', selector: "a.is-image-visible, a.medium-layout, a.small-layout", extract: simpleExtractor, technology: 'playwright' },
        { key: 'faz', name: 'Frankfurter Allgemeine Zeitung (FAZ)', url: 'https://www.faz.net/aktuell/wirtschaft/', newspaper: 'Frankfurter Allgemeine Zeitung (FAZ)', selector: "a.block, main article a, .teaser a, a[href*=\"/aktuell/\"]:not(.clickable)", extract: simpleExtractor, technology: 'playwright' },
        { key: 'sueddeutsche_zeitung', name: 'Süddeutsche Zeitung', url: 'https://www.sueddeutsche.de/wirtschaft', newspaper: 'Süddeutsche Zeitung', selector: "article h2 a, article h3 a, .teaser__link, .teaser a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'der_spiegel', name: 'Der Spiegel', url: 'https://www.spiegel.de/wirtschaft/', newspaper: 'Der Spiegel', selector: "a.text-black", extract: simpleExtractor, technology: 'playwright' },
        { key: 'tagesschau', name: 'Tagesschau', url: 'https://www.tagesschau.de/wirtschaft/', newspaper: 'Tagesschau', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'die_zeit', name: 'Die Zeit', url: 'https://www.zeit.de/wirtschaft/index', newspaper: 'Die Zeit', selector: "a.zon-teaser__link, a.zon-teaser__faux-link", extract: simpleExtractor, technology: 'playwright' },
        { key: 'manager_magazin', name: 'Manager Magazin', url: 'https://www.manager-magazin.de/', newspaper: 'Manager Magazin', selector: "a.text-black, a[href*='-a-']", extract: simpleExtractor, technology: 'playwright' },
        { key: 'boerse_online', name: 'Börse Online', url: 'https://www.boerse-online.de/', newspaper: 'Börse Online', selector: "a[href^=\"/nachrichten/\"], a[href^=\"/dpa-afx/\"]", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Switzerland ---
  {
    countryName: 'Switzerland',
    flag: '🇨🇭',
    sites: [
        { key: 'handelszeitung', name: 'Handelszeitung', url: 'https://www.handelszeitung.ch', newspaper: 'Handelszeitung', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'finanz_und_wirtschaft', name: 'Finanz und Wirtschaft', url: 'https://www.fuw.ch', newspaper: 'Finanz und Wirtschaft', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'nzz', name: 'Neue Zürcher Zeitung (NZZ)', url: 'https://www.nzz.ch/wirtschaft/', newspaper: 'Neue Zürcher Zeitung (NZZ)', selector: "a.teaser__link", extract: simpleExtractor, technology: 'playwright' },
        { key: 'blick', name: 'Blick', url: 'https://www.blick.ch/wirtschaft/', newspaper: 'Blick', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
        { key: 'srf', name: 'SRF', url: 'https://www.srf.ch/news/wirtschaft', newspaper: 'SRF', selector: "a.teaser-ng", extract: simpleExtractor, technology: 'playwright' },
        { key: 'swissinfo_ch', name: 'swissinfo.ch', url: 'https://www.swissinfo.ch/eng/business', newspaper: 'swissinfo.ch', selector: "a[class$='__link'][href*='/eng/']", extract: simpleExtractor, technology: 'playwright' },
        { key: '20_minuten', name: '20 Minuten', url: 'https://www.20min.ch/wirtschaft/', newspaper: '20 Minuten', selector: "a.sc-4c3a0c12-1[href^=\"/story/\"]", extract: simpleExtractor, technology: 'playwright' },
        { key: 'cash_ch', name: 'cash.ch', url: 'https://www.cash.ch', newspaper: 'cash.ch', selector: "article a", extract: simpleExtractor, technology: 'playwright' },
    ]
  },
  // --- Pan-Nordic --- (KEEPING EXISTING)
  {
    countryName: 'Pan-Nordic',
    flag: '🇪🇺',
    sites: [
      { key: 'nordic_capital', name: 'Nordic Capital', url: 'https://www.nordiccapital.com/news-views/', newspaper: 'Nordic Capital', selector: 'article.masonry-card--component a', extract: (el, site) => { const headline = el.find('h3').text().trim(); const href = el.attr('href'); if (headline && href) { return { headline, link: href, source: site.name, newspaper: site.newspaper }; } return null; }, technology: 'axios' },
      { key: 'altor', name: 'Altor', url: 'https://www.altor.com/news/', newspaper: 'Altor', selector: 'a.g-content-card.g-news__item', extract: (el, site) => ({ headline: el.find('p.g-content-card__header').text().trim(), link: el.attr('href'), source: site.name, newspaper: site.newspaper, }), technology: 'axios' },
    ]
  }
  // Add other countries from the large JSON following the same pattern...
];

// --- Create and export maps for use in other modules ---
export const newspaperToCountryMap = new Map();
export const countryNameToFlagMap = new Map();
export const newspaperToTechnologyMap = new Map();

COUNTRIES_CONFIG.forEach(country => {
  countryNameToFlagMap.set(country.countryName, country.flag);
  country.sites.forEach(site => {
    const newspaperName = site.newspaper || site.name;
    if (!newspaperToCountryMap.has(newspaperName)) {
      newspaperToCountryMap.set(newspaperName, country.countryName);
    }
    // Set scraping technology for each newspaper
    newspaperToTechnologyMap.set(newspaperName, site.technology || 'axios');
  });
});


export const TEXT_SELECTORS = {
  // Denmark
  'Berlingske': '.article-body p',
  'Børsen': [ '.article-content', 'meta[name="description"]' ],
  'Politiken': 'section#js-article-body .font-serif-body-20 p',
  'Finans.dk': 'p.container-text:not([class*="italic"])',
  'Axcel': 'div.article-content p',
  'Polaris': 'div.fl-module-fl-post-content p',
  // Norway
  'Finansavisen': [ '.c-article-regular__body__preamble, .c-article-regular__body p', 'meta[name="description"]' ],
  'E24': 'article p[data-test-tag="lead-text"], article p.hyperion-css-1lemvax',
  'FSN Capital': 'div.newspage__content p',
  'Verdane': '.entry-content p',
  'Dagens Næringsliv': 'div[class*="content"] p',
  'NRK': 'main p',
  'Aftenposten': 'article p',
  'Nettavisen': 'main p',
  'TV 2': 'main p',
  // Sweden
  'Dagens Industri': 'div[class*="content"] p',
  'Svenska Dagbladet': 'main p',
  'Dagens Nyheter': 'main p',
  'Breakit': 'article p',
  'EFN Ekonomikanalen': 'main p',
  'SVT Nyheter': 'main p',
  'Affärsvärlden': 'div.article-body p',
  // Finland
  'Talouselämä': 'article p',
  'Kauppalehti': 'div[class*="content"] p',
  'Helsingin Sanomat': 'main p',
  'Iltalehti': 'body.cleaned',
  'Taloussanomat (Ilta-Sanomat)': 'main p',
  'MTV Uutiset': 'main p',
  'Yle': 'body.cleaned',
  // Netherlands
  'Het Financieele Dagblad (FD.nl)': 'div[class*="content"] p',
  'De Telegraaf – DFT': 'div[class*="content"] p',
  'Business Insider Nederland': 'div[class*="content"] p',
  'Quote.nl': 'main p',
  'IEX.nl': 'div[class*="content"] p',
  'NRC Handelsblad': 'main p',
  'De Volkskrant': 'main p',
  'Trouw.nl': 'main p',
  'Algemeen Dagblad (ad.nl)': 'div[class*="content"] p',
  'Follow the Money (ftm.nl)': 'main p',
  'Pensioen Pro': 'body.cleaned',
  'Vastgoedmarkt.nl': null,
  // Spain
  'Cinco Días': 'main p',
  'Expansión': 'main p',
  'El Economista': 'div[class*="content"] p',
  'El Confidencial': 'div[class*="content"] p',
  'La Vanguardia': 'main p',
  'Vozpópuli': 'main p',
  'Invertia': 'div[class*="text"] p',
  // France
  'Le Figaro': 'div[class*="content"] p',
  'La Tribune': 'body.cleaned',
  'Capital': 'div[class*="content"] p',
  'BFM Business': 'main p',
  'Challenges': 'div[class*="content"] p',
  'Le Monde': 'div[class*="content"] p',
  'France Info': 'div[class*="content"] p',
  'L\'Opinion': 'body.cleaned',
  'L\'Indépendant': 'div[class*="content"] p',
  // United Kingdom
  'Financial Times': 'div[class*="content"] p',
  'BBC News': 'main p',
  'The Guardian': 'main p',
  'The Times': 'body.cleaned',
  'Investors\' Chronicle': 'div[class*="content"] p',
  // Germany
  'Handelsblatt': 'article p',
  'Frankfurter Allgemeine Zeitung (FAZ)': 'div[class*="content"] p',
  'Süddeutsche Zeitung': 'main p',
  'Der Spiegel': 'main p',
  'Die Zeit': 'div[class*="content"] p',
  'Manager Magazin': 'main p',
  'Börse Online': 'main p',
  // Switzerland
  'Neue Zürcher Zeitung (NZZ)': 'body.cleaned',
  'SRF': 'main p',
  'swissinfo.ch': 'div[class*="content"] p',
  '20 Minuten': 'div[class*="content"] p',
  // Pan-Nordic
  'Nordic Capital': '.multi-column-rich-text--content-block .block-content p',
  'EQT': '.body-l-body-m p',
  'Altor': 'div.g-wysiwyg p',
};