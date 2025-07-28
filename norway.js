import axios from 'axios';
import * as cheerio from 'cheerio';

const url = 'https://www.finansavisen.no/kapital';

/**
 * Fetches the HTML content of the target website.
 * @returns {Promise<string>} The HTML content as a string.
 */
async function downloadWebsite() {
  try {
    console.log(`Downloading HTML from ${url}...`);
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error downloading the website: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parses the HTML to extract headlines and their hyperlinks.
 * @param {string} html - The HTML content of the website.
 * @returns {Array<Object>} A list of article objects with headlines and hyperlinks.
 */
function listHeadlines(html) {
  const articles = [];
  const $ = cheerio.load(html);
  const baseUrl = 'https://www.finansavisen.no';

  // Each article seems to be within an <article> tag with the class 'dre-item'
  $('article.dre-item').each((index, element) => {
    // The headline text and link are within an <a> tag with the class 'dre-item__title'
    const titleElement = $(element).find('a.dre-item__title');
    
    if (titleElement.length > 0) {
      // Extract the raw text and clean it up by removing extra whitespace/newlines
      const headline = titleElement.text().trim().replace(/\s+/g, ' ');
      const relativeLink = titleElement.attr('href');

      if (headline && relativeLink) {
        articles.push({
          headline: headline,
          hyperlink: `${baseUrl}${relativeLink}`
        });
      }
    }
  });
  
  return articles;
}

/**
 * Main function to run the scraper.
 */
async function main() {
  const html = await downloadWebsite();
  const headlines = listHeadlines(html);
  
  console.log('Successfully scraped the following headlines:');
  console.log(JSON.stringify(headlines, null, 2));
}

main();