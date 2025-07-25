import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getLogger } from "@daitanjs/development";
import randomUserAgent from "random-useragent";
import { construct, generateIntelligence } from "@daitanjs/intelligence";
import { configureEnv } from "@daitanjs/development";
import dotenv from "dotenv";
import path from "path";

import { logAndThrow } from "@daitanjs/utilities";

configureEnv();
dotenv.config({ path: path.resolve("/home/mark/Repos/.env") });
puppeteer.use(StealthPlugin());

const logger = getLogger("analyzePageClasses");

export async function analyzePageClasses(url) {
  logger.info(`🔹 Starting page analysis for: ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox"],
    });

    const page = await setupPage(browser, url);
    const classes = await extractClasses(page);

    if (classes.length === 0) {
      logger.warn(`⚠ No CSS classes detected on the page: ${url}`);
      return {};
    }

    const analysisResult = await analyzeClasses(classes, url);
    const extractionResults = await extractElementsByClass(page, analysisResult);

    printExtractionResults(extractionResults);
    return extractionResults;
  } catch (error) {
    logger.error("❌ Error occurred while analyzing page classes", {
      message: error.message,
      stack: error.stack || "No stack available",
    });
    return {};
  } finally {
    if (browser) {
      await browser.close();
      logger.info("🛑 Browser instance closed.");
    }
  }
}

async function setupPage(browser, url) {
  try {
    logger.info(`🔹 Launching new page for: ${url}`);

    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent.getRandom());

    logger.info(`🌐 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2" });

    logger.info(`✅ Page loaded successfully: ${url}`);
    return page;
  } catch (error) {
    logAndThrow(error, `❌ Error loading page: ${url}`);
  }
}

async function extractClasses(page) {
  try {
    logger.info("🔹 Extracting all CSS classes from the page...");

    const classes = await page.evaluate(() => {
      const allElements = [...document.querySelectorAll("*")];
      return [
        ...new Set(
          allElements
            .map((el) => el.className)
            .filter((className) => typeof className === "string" && className.trim() !== "")
            .flatMap((className) => className.split(" "))
            .filter(Boolean)
        ),
      ];
    });

    if (classes.length > 0) {
      logger.info(`✅ Extracted ${classes.length} unique CSS classes.`);
    } else {
      logger.warn("⚠ No CSS classes found on the page.");
    }

    return classes;
  } catch (error) {
    logAndThrow(error, "❌ Error extracting classes from the page");
  }
}

async function analyzeClasses(classes, url) {
  try {
    logger.info(`🔹 Analyzing ${classes.length} CSS classes for article structure.`);

    const prompt = `
      You are analyzing the structure of a news article webpage. Here is the list of all CSS classes found on the page: ${JSON.stringify(
        classes
      )}.
      Please classify these classes based on their probable roles in the webpage as follows:
      1. **Headlines**: Which classes are used for article headlines?
      2. **Subheadings**: Which classes are used for subheadings?
      3. **Captions**: Which classes are used for image captions?
      4. **Content**: Which classes are used for the main article body?
      Make educated guesses based on the typical use of these classes and their potential names.
      Also, suggest how each class should be used in the extraction process.
    `;

    const messages = construct({
      instruction: "Analyze webpage CSS classes to identify their roles.",
      shotsInput: [],
      shotsOutput: [],
      prompt,
    });

    const response = await generateIntelligence({
      model: "gpt-4o-mini",
      summary: "Article class analysis",
      messages,
      max_tokens: 1500,
    });

    if (!response) {
      throw new Error("❌ No response from AI class analysis.");
    }

    logger.info("✅ Successfully analyzed CSS classes.");
    return response;
  } catch (error) {
    logAndThrow(error, "❌ Error analyzing CSS classes.");
  }
}

async function extractElementsByClass(page, analysisResult) {
  try {
    logger.info("🔹 Extracting elements based on identified classes...");

    if (!analysisResult || Object.keys(analysisResult).length === 0) {
      logger.warn("⚠ No classes were identified for extraction.");
      return {};
    }

    const extractionResults = {};
    for (const [key, value] of Object.entries(analysisResult)) {
      if (value.classes && Array.isArray(value.classes)) {
        extractionResults[key] = await extractElementsForClasses(page, key, value.classes);
      }
    }

    return extractionResults;
  } catch (error) {
    logAndThrow(error, "❌ Error extracting elements based on classes.");
  }
}

async function extractElementsForClasses(page, key, classes) {
  const extractionResults = {};
  for (const className of classes) {
    if (!isValidCSSSelector(className)) {
      logger.warn(`⚠ Skipping invalid CSS class selector: "${className}"`);
      continue;
    }

    try {
      const elements = await page.evaluate((className) => {
        return [...document.querySelectorAll(`.${className}`)]
          .map((el) => el.textContent.trim())
          .filter(Boolean);
      }, className);

      extractionResults[className] = elements;
      logger.info(`✅ Extracted ${elements.length} elements for "${key}" using class "${className}"`);
    } catch (error) {
      logAndThrow(error, `❌ Error extracting elements for class "${className}"`);
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
    headlines: "📰 HEADLINE",
    subheadings: "🔹 SUBHEADER",
    captions: "🖼 CAPTION",
    content: "📄 BODY",
  };

  Object.entries(extractionResults).forEach(([key, classes]) => {
    if (categoryLabels[key]) {
      console.log(`\n${categoryLabels[key]}`);
      Object.entries(classes).forEach(([className, items]) => {
        items.forEach((item) => {
          const truncatedText = item.length > 100 ? `${item.substring(0, 100)}...` : item;
          console.log(`${className} - ${truncatedText}`);
        });
      });
      console.log(""); // Add an empty line between categories
    }
  });
}
