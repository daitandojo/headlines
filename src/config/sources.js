// File: headlines_mongo/src/config/sources.js

export const SOURCES = [
  {
    name: 'Børsen',
    newspaper: 'Borsen',
    baseUrl: 'https://borsen.dk',
    startUrl: 'https://borsen.dk/nyheder',
    // This part is correct and highly efficient for Borsen.
    parserType: 'json-attr',
    linkPosition: 'relative',
    jsonAttrConfig: {
      selector: 'continuous-scrolling-list',
      attribute: 'json_articles',
    },
    // This is the individual article scraper, now with robust selectors.
    enrichmentParserType: 'jsdom',
    articleStructure: [
      {
        elementName: 'headlines',
        selector:
          'h1.article-header__title, h1.tiempos-headline, .article__title',
      },
      {
        elementName: 'subheadings',
        selector:
          'p.article-header__intro, .article__summary, .teaser__summary, h2.article-header__intro',
      },
      {
        elementName: 'contents',
        selector:
          '.article-body__content p, .article__body-text p, .c-article-content p, .article-body__text > p',
      },
      {
        elementName: 'captions',
        selector: 'figure figcaption, .image-caption__text',
      },
    ],
  },
  {
    name: 'Berlingske',
    newspaper: 'Berlingske',
    baseUrl: 'https://www.berlingske.dk',
    startUrl: 'https://www.berlingske.dk/business',
    // CORRECTED: Selectors that target the article containers directly.
    linkSelector: '.teaser__title-link, a.teaser__title-link',
    linkPosition: 'relative',
    parserType: 'jsdom',
    enrichmentParserType: 'jsdom',
    articleStructure: [
      {
        elementName: 'headlines',
        selector: '.article-header__title, h1.headline',
      },
      {
        elementName: 'subheadings',
        selector:
          '.article-header__intro, .article-header__summary, .article-header__deck',
      },
      {
        elementName: 'captions',
        selector:
          '.image-caption__short-caption-text, figcaption, .image-caption p',
      },
      {
        elementName: 'contents',
        selector:
          '.article-body p, .article-body-text-container p, div[data-type="bodyText"] p, .article-content p',
      },
    ],
  },
  {
    name: 'Politiken',
    newspaper: 'Politiken',
    baseUrl: 'https://politiken.dk',
    startUrl: 'https://politiken.dk/danmark/oekonomi/',
    // CORRECTED: Using more specific and combined selectors for Politiken's layout.
    linkSelector:
      'a.teaser__title-link, h3.font-serif-header-44 a, .teaser__title a, a.article-title',
    linkPosition: 'relative',
    parserType: 'jsdom',
    enrichmentParserType: 'jsdom',
    articleStructure: [
      {
        elementName: 'headlines',
        selector:
          'h1.article__title, h2.article__title, h3.article__title, .article-header__title, .headline__title, .content-header__title',
      },
      {
        elementName: 'subheadings',
        selector:
          '.article__summary, .article-header__intro, .teaser__summary, .article__deck',
      },
      {
        elementName: 'captions',
        selector: 'figcaption, .image__caption-text, .photographer, .caption',
      },
      {
        elementName: 'contents',
        selector:
          '.article__body > p, .body__paragraph, div[data-art-type="bodyText"] p, .art-wysiwyg p, .article-body__content p',
      },
    ],
  },
  {
    name: 'Finans.dk',
    newspaper: 'Finans.dk',
    baseUrl: 'https://finans.dk',
    startUrl: 'https://finans.dk/seneste-nyt/',
    // CORRECTED: Targets the h3 within the link, which is a very stable pattern in the provided HTML.
    linkSelector: 'article a h3, a.fs-teaser-link',
    linkPosition: 'relative',
    parserType: 'jsdom',
    enrichmentParserType: 'jsdom',
    articleStructure: [
      {
        elementName: 'headlines',
        selector: 'h1.c-article-top-info__title, h1.article-header__title',
      },
      {
        elementName: 'subheadings',
        selector: 'p.c-article-top-info__description, .article-header__summary',
      },
      {
        elementName: 'contents',
        // CORRECTED: A more specific selector for the main article text container.
        selector:
          'div.c-article-text-container > div > p, .article-body p, div[data-cy="article-body"] p',
      },
      {
        elementName: 'captions',
        selector:
          'figure.c-article-top-image > figcaption.c-article-top-image__caption, figcaption',
      },
    ],
  },
];
