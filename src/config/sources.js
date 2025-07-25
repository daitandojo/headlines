export const SOURCES = [
  {
    name: 'Børsen',
    newspaper: 'Borsen',
    baseUrl: 'https://borsen.dk',
    startUrl: 'https://borsen.dk/nyheder',
    linkSelector: 'a.news-card__link-wrapper, a.teaser__title-link',
  },
  {
    name: 'Berlingske',
    newspaper: 'Berlingske',
    baseUrl: 'https://www.berlingske.dk',
    startUrl: 'https://www.berlingske.dk/business',
    linkSelector: '.teaser__title-link, a.teaser__title-link',
  },
  {
    name: 'Politiken',
    newspaper: 'Politiken',
    baseUrl: 'https://politiken.dk',
    startUrl: 'https://politiken.dk/danmark/oekonomi/',
    linkSelector: 'a.teaser__title-link, h3.font-serif-header-44 a, .teaser__title a, a.article-title',
  },
  {
    name: 'Finans.dk',
    newspaper: 'Finans.dk',
    baseUrl: 'https://finans.dk',
    startUrl: 'https://finans.dk/seneste-nyt/',
    linkSelector: 'article a h3, a.fs-teaser-link',
  },
];