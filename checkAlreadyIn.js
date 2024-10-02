import path from 'path';
import dotenv from 'dotenv';
import { readJSONsFromFile, extractField } from 'daitanjs/jsonstore';  // Import readJSONsFromFile from jsonStore
import { fuzzyCompare } from 'daitanjs/intelligence';
import { memoryPath } from './src/config/config.js'

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const FILE_PATH = `${memoryPath}/articles.data`;

async function main(headline) {
  try {
    console.log(`Trying to match headline "${headline}" with following results:`)
    const allArticles = readJSONsFromFile({ filePath: FILE_PATH });
    const lastTopics = extractField(allArticles, 'topic', 30);
    console.log(lastTopics);

    const relevanceResult = await fuzzyCompare(lastTopics, headline);

    console.log('AI Assessment Result:', relevanceResult);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

const headlineToCheck = "Lunar Seeking New Investors";
main(headlineToCheck);
