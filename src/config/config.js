  import { fileURLToPath } from 'url';
  import { dirname } from 'path';
  import dotenv from 'dotenv';
  import path from 'path';

  // Load environment variables from .env file
  dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

  // File path utilities
  export const __filename = fileURLToPath(import.meta.url);
  export const __dirname = dirname(__filename);

  export const memoryPath = 
    (process.env.NODE_ENV === "development")
    ? "./output"
    : "/data"

  // Application Constants
  export const RELEVANCE_THRESHOLD = 59;

  // Email Recipients List
  export const EMAIL_RECIPIENTS = [
    'reconozco@gmail.com', 
    'christiansenalexandra@gmail.com'
  ];

  // Sources Configuration for Headline Extraction
  export const SOURCES = [
    {
      BASE_URL: 'https://borsen.dk',
      NEWSPAPER: 'Borsen',
      BASE_DIRECTORY: '/nyheder',
      LINK_CLASS: 'tiempos-text',
      ARTICLE_STRUCTURE: [
        { elementName: "headlines", selector: 'h1.tiempos-headline' },
        { elementName: "subheadings", selector: 'strong.subheading' },
        { elementName: "captions", selector: 'figcaption.gta' },
        { elementName: "contents", selector: '.article-content > *' }
      ],
      LINK_POSITION: 'relative',
      PARSER_TYPE: 'cheerio' 
    },
    {
      BASE_URL: 'https://berlingske.dk',
      NEWSPAPER: 'Berlingske',
      BASE_DIRECTORY: '/business',
      LINK_CLASS: 'teaser__title-link',
      ARTICLE_STRUCTURE: [
        { elementName: "headlines", selector: '.article-header__title' },
        { elementName: "subheadings", selector: '.article-header__intro' },
        { elementName: "captions", selector: '.image-caption__short-caption-inner' },
        { elementName: "contents", selector: '.article-body p' }
      ],
      LINK_POSITION: 'relative',
      PARSER_TYPE: 'cheerio'
    },
    {
      BASE_URL: 'https://politiken.dk',
      NEWSPAPER: 'Politiken',
      BASE_DIRECTORY: '/danmark/oekonomi',
      LINK_CLASS: 'article-intro__title',
      ARTICLE_STRUCTURE: [
        { elementName: "headlines", selector: '.article__title' },
        { elementName: "subheadings", selector: '.summary__p' },
        { elementName: "captions", selector: 'figcaption.media__caption' },
        { elementName: "contents", selector: '.article__body > *' }
      ],
      LINK_POSITION: 'absolute',
      PARSER_TYPE: 'cheerio'
    },
    {
      BASE_URL: 'https://finans.dk',
      NEWSPAPER: 'Finans.dk',
      BASE_DIRECTORY: '/seneste-nyt',
      LINK_CLASS: 'c-article-teaser-heading__link',
      ARTICLE_STRUCTURE: [
        { elementName: "headlines", selector: '.c-article-top-info__title' },
        { elementName: "subheadings", selector: '.c-article-top-info__description' },
        { elementName: "captions", selector: 'figcaption.c-article-top-image__caption' },
        { elementName: "contents", selector: '.c-article-text-container > * > *' }
      ],
      LINK_POSITION: 'relative',
      PARSER_TYPE: 'cheerio'
    }
  ];

  // Paths to store headlines and articles data
  export const HEADLINES_PATH = './output/headlines.data';
  export const ARTICLES_PATH = './output/articles.data';

  // Email Template Configuration
  export const EMAIL_CONFIG = {
    templateName: 'wealthEvents',
    subject: '🇩🇰 New Danish Banking Opportunities Detected',
    language: 'en',
    maxWidth: '600px',
    backgroundColor: '#F7F9FC',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    headingColor: '#333333',
    paragraphColor: '#7F8C8D',
    cardBackgroundColor: '#FFFFFF',
    cardBorderColor: '#AAAAAA'
  };

  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)
  console.log(process.env.GMAIL_PASS)

  // SMTP Server Configuration for Sending Emails
  export const SMTP_CONFIG = {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  };
