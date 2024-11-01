// File: src/modules/scraping/analyzePageClasses.js

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getLogger } from 'daitanjs/development';
import randomUserAgent from 'random-useragent';
import { construct, generateIntelligence } from 'daitanjs/intelligence';
import { configureEnv } from 'daitanjs/development';
import dotenv from 'dotenv';
import path from 'path';

import { logAndThrow, safeExecute } from '../../utils/errorHandler';

configureEnv();
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });
puppeteer.use(StealthPlugin());

const logger = getLogger('analyzePageClasses');

export async function analyzePageClasses(url) {
  logger.info(`Starting analysis for page: ${url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    const page = await setupPage(browser, url);
    const classes = await extractClasses(page);
    const analysisResult = await analyzeClasses(classes, url);
    const extractionResults = await extractElementsByClass(page, analysisResult);
    
    printExtractionResults(extractionResults);
    return extractionResults;

  } catch (error) {
    logger.error('Error occurred while analyzing page classes', { error: error.message, stack: error.stack });
  } finally {
    if (browser) await browser.close();
  }
}

async function setupPage(browser, url) {
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent.getRandom());
  await page.goto(url, { waitUntil: 'networkidle2' });
  logger.info(`Page loaded successfully: ${url}`);
  return page;
}

async function extractClasses(page) {
  try {
    logger.info('Extracting all classes from the page.');
    const classes = await page.evaluate(() => {
      const allElements = [...document.querySelectorAll('*')];
      return [...new Set(
        allElements
          .map(el => el.className)
          .filter(className => typeof className === 'string' && className.trim() !== '')
          .flatMap(className => className.split(' '))
          .filter(Boolean)
      )];
    });

    logger.info('Classes extracted from the page successfully.');
    return classes;

  } catch (error) {
    logger.error('Error extracting classes from the page', { error });
    throw error;
  }
}

async function analyzeClasses(classes, url) {
  try {
    logger.info(`Analyzing ${classes.length} classes to identify article components.`);

    const prompt = `
      You are analyzing the structure of a news article webpage. Here is the list of all CSS classes found on the page: ${JSON.stringify(classes)}.
      Please classify these classes based on their probable roles in the webpage as follows:
      1. **Headlines**: Which classes are used for article headlines?
      2. **Subheadings**: Which classes are used for subheadings?
      3. **Captions**: Which classes are used for image captions?
      4. **Content**: Which classes are used for the main article body?
      Make educated guesses based on the typical use of these classes and their potential names.
      Also, suggest how each class should be used in the extraction process.
    `;

    const messages = construct({
      instruction: 'Analyze webpage CSS classes to identify their roles.',
      shotsInput: [],
      shotsOutput: [],
      prompt,
    });

    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      summary: 'Article class analysis',
      messages,
      max_tokens: 1500,
    });

    if (!response) {
      throw new Error('No response from OpenAI service.');
    }

    logger.info('Analysis of CSS classes completed successfully.');
    return response;

  } catch (error) {
    logAndThrow(error, 'Error occurred during class analysis');
  }
}

async function extractElementsByClass(page, analysisResult) {
  try {
    logger.info('Starting extraction of elements based on identified classes.');

    const extractionResults = {};
    for (const [key, value] of Object.entries(analysisResult)) {
      if (value.classes && Array.isArray(value.classes)) {
        extractionResults[key] = await extractElementsForClasses(page, key, value.classes);
      }
    }

    return extractionResults;

  } catch (error) {
    logAndThrow('Error occurred during element extraction', { error });
  }
}

async function extractElementsForClasses(page, key, classes) {
  const extractionResults = {};
  for (const className of classes) {
    if (!isValidCSSSelector(className)) {
      logger.warn(`Skipping invalid class selector: "${className}"`);
      continue;
    }

    try {
      const elements = await page.evaluate((className) => {
        return [...document.querySelectorAll(`.${className}`)]
          .map(el => el.textContent.trim())
          .filter(Boolean);
      }, className);

      extractionResults[className] = elements;
      logger.info(`Extracted ${elements.length} elements for ${key} with class "${className}"`);

    } catch (error) {
      logAndThrow(`Error extracting elements for class "${className}"`, { error });
    }
  }
  return extractionResults;
}

function isValidCSSSelector(className) {
  const invalidCharacters = /[:[/ . \\]]/; // Match invalid characters for CSS class names
  return !invalidCharacters.test(className);
}

function printExtractionResults(extractionResults) {
  const categoryLabels = {
    headlines: 'HEADLINE',
    subheadings: 'SUBHEADER',
    captions: 'CAPTION',
    content: 'BODY',
  };

  Object.entries(extractionResults).forEach(([key, classes]) => {
    if (categoryLabels[key]) {
      console.log(categoryLabels[key]);
      Object.entries(classes).forEach(([className, items]) => {
        items.forEach(item => {
          const truncatedText = item.length > 100 ? `${item.substring(0, 100)}...` : item;
          console.log(`${className} - ${truncatedText}`);
        });
      });
      console.log(''); // Add an empty line between categories
    }
  });
}
