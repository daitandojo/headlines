import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getLogger } from 'daitanjs/development';
import randomUserAgent from 'random-useragent';
import { construct, generateIntelligence } from 'daitanjs/intelligence';

import { configureEnv } from 'daitanjs/development';
import dotenv from 'dotenv';
import path from 'path';

configureEnv();
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

puppeteer.use(StealthPlugin());

const logger = getLogger('findArticleClasses');

async function analyzePageClasses(url) {
  logger.info(`Starting analysis for page: ${url}`);

  let browser;
  try {
    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent.getRandom());
    await page.goto(url, { waitUntil: 'networkidle2' });

    logger.info('Page loaded successfully, starting extraction.');

    // Extract all classes from the HTML
    const classes = await page.evaluate(() => {
      const allElements = [...document.querySelectorAll('*')];
      const classNames = allElements
        .map(el => el.className)
        .filter(className => typeof className === 'string' && className.trim() !== '')
        .flatMap(className => className.split(' '))
        .filter(Boolean);
      return [...new Set(classNames)];
    });

    logger.info('Classes extracted from the page successfully.');
    await browser.close();

    // Analyze the extracted classes
    const analysisResult = await analyzeClasses(classes, url);

    // Extract elements based on the identified classes
    const extractionResults = await extractElementsByClass(url, analysisResult);

    // Print the formatted extraction results
    printExtractionResults(extractionResults);

    return extractionResults;

  } catch (error) {
    logger.error('Error occurred while analyzing page classes', {
      error: error.message,
      stack: error.stack,
    });
    if (browser) await browser.close();
    throw error;
  }
}

async function analyzeClasses(classes, url) {
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

  try {
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
    console.log(response);
    return response;
  } catch (error) {
    logger.error('Error occurred during class analysis', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function extractElementsByClass(url, analysisResult) {
  logger.info('Starting extraction of elements based on identified classes.');

  let browser;
  try {
    // Launch Puppeteer browser again for extraction
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent.getRandom());
    await page.goto(url, { waitUntil: 'networkidle2' });

    const extractionResults = {};

    for (const [key, value] of Object.entries(analysisResult)) {
      if (value.classes && Array.isArray(value.classes)) {
        extractionResults[key] = {};

        for (const className of value.classes) {
          // Filter out classes that contain invalid characters for querySelectorAll
          if (!isValidCSSSelector(className)) {
            logger.warn(`Skipping invalid class selector: "${className}"`);
            continue;
          }

          // Extract elements by class
          const elements = await page.evaluate((className) => {
            return [...document.querySelectorAll(`.${className}`)].map(el => el.textContent.trim()).filter(Boolean);
          }, className);

          extractionResults[key][className] = elements;

          logger.info(`Extracted ${elements.length} elements for ${key} with class "${className}"`);
        }
      }
    }

    await browser.close();
    return extractionResults;

  } catch (error) {
    logger.error('Error occurred during element extraction', {
      error: error.message,
      stack: error.stack,
    });
    if (browser) await browser.close();
    throw error;
  }
}

// Helper function to check if a class name is a valid CSS selector
function isValidCSSSelector(className) {
  const invalidCharacters = /[:[/ . \\]]/; // Match invalid characters for CSS class names
  return !invalidCharacters.test(className);
}

// Function to print the extraction results in the specified format
function printExtractionResults(extractionResults) {
  const categoryLabels = {
    headlines: 'HEADLINE',
    subheadings: 'SUBHEADER',
    captions: 'CAPTION',
    content: 'BODY',
  };

  for (const [key, classes] of Object.entries(extractionResults)) {
    if (categoryLabels[key]) {
      console.log(categoryLabels[key]);
      for (const [className, items] of Object.entries(classes)) {
        items.forEach(item => {
          const truncatedText = item.length > 100 ? `${item.substring(0, 100)}...` : item;
          console.log(`${className} - ${truncatedText}`);
        });
      }
      console.log(''); // Add an empty line between categories
    }
  }
}

// Running Example
(async () => {
  const url = 'https://finans.dk/seneste-nyt';
  try {
    const extractionResults = await analyzePageClasses(url);
    console.log('Extraction Results:', JSON.stringify(extractionResults, null, 2));
  } catch (error) {
    console.error('Error running article class analyzer:', error.message);
  }
})();
