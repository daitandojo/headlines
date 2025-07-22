// File: headlines_mongo/src/utils/configValidator.js
import { getLogger } from '@daitanjs/development'; // Use central DaitanJS logger
import { isValidURL } from '@daitanjs/validation'; // Use utility from DaitanJS
import { SOURCES } from '../config/sources.js'; // App-specific SOURCES import

const logger = getLogger('headlines-mongo-config-validator'); // App-namespaced logger

/**
 * Validates a single source configuration object.
 * @param {object} source - The source configuration object.
 * @param {number} index - The index of the source in the SOURCES array (for logging).
 * @returns {boolean} - True if the source configuration is valid, false otherwise.
 */
function validateSingleSource(source, index) {
  const sourceNameForLog = source?.name || `Unnamed Source at index ${index}`; // Added optional chaining for source.name
  let isValid = true;

  if (!source || typeof source !== 'object') {
    logger.error(
      `[${sourceNameForLog}] Source configuration (index ${index}) is not a valid object.`
    );
    return false; // Fatal error for this source object, it's not even an object
  }

  const requiredFields = [
    'name',
    'newspaper',
    'baseUrl',
    'startUrl',
    'parserType',
    'articleStructure',
  ];
  for (const field of requiredFields) {
    if (!source[field]) {
      logger.error(`[${sourceNameForLog}] Missing required field: '${field}'.`);
      isValid = false;
    }
  }

  // Validate URL fields if present (and if the field itself exists)
  if (source.baseUrl && !isValidURL(source.baseUrl)) {
    // isValidURL from @daitanjs/utilities
    logger.error(`[${sourceNameForLog}] Invalid baseUrl: "${source.baseUrl}".`);
    isValid = false;
  }
  if (source.startUrl && !isValidURL(source.startUrl)) {
    logger.error(
      `[${sourceNameForLog}] Invalid startUrl: "${source.startUrl}".`
    );
    isValid = false;
  }

  // Validate parserType specific requirements
  const validParserTypes = ['cheerio', 'jsdom', 'json-attr']; // As defined by @daitanjs/web (presumably)
  if (source.parserType && !validParserTypes.includes(source.parserType)) {
    logger.error(
      `[${sourceNameForLog}] Invalid parserType: "${
        source.parserType
      }". Must be one of ${validParserTypes.join(', ')}.`
    );
    isValid = false;
  }

  if (source.parserType === 'json-attr') {
    if (!source.jsonAttrConfig || typeof source.jsonAttrConfig !== 'object') {
      logger.error(
        `[${sourceNameForLog}] Missing or invalid 'jsonAttrConfig' object for parserType 'json-attr'.`
      );
      isValid = false;
    } else {
      if (
        !source.jsonAttrConfig.selector ||
        typeof source.jsonAttrConfig.selector !== 'string' ||
        source.jsonAttrConfig.selector.trim() === ''
      ) {
        logger.error(
          `[${sourceNameForLog}] Missing, invalid, or empty 'jsonAttrConfig.selector' string.`
        );
        isValid = false;
      }
      if (
        !source.jsonAttrConfig.attribute ||
        typeof source.jsonAttrConfig.attribute !== 'string' ||
        source.jsonAttrConfig.attribute.trim() === ''
      ) {
        logger.error(
          `[${sourceNameForLog}] Missing, invalid, or empty 'jsonAttrConfig.attribute' string.`
        );
        isValid = false;
      }
    }
  } else if (source.parserType === 'cheerio' || source.parserType === 'jsdom') {
    // A linkSelector OR linkClass is usually needed for non-json-attr types by @daitanjs/web's downloadAndExtract
    if (!source.linkSelector && !source.linkClass) {
      logger.warn(
        `[${sourceNameForLog}] For parserType '${source.parserType}', neither 'linkSelector' nor 'linkClass' is defined. This might lead to no links being found by @daitanjs/web.`
      );
      // Not strictly making isValid = false, as some custom extraction logic might not need it,
      // but it's a strong warning for typical usage with downloadAndExtract's link extraction.
    }
  }

  // Validate articleStructure
  if (
    !source.articleStructure ||
    !Array.isArray(source.articleStructure) ||
    source.articleStructure.length === 0
  ) {
    logger.error(
      `[${sourceNameForLog}] 'articleStructure' must be a non-empty array.`
    );
    isValid = false;
  } else {
    source.articleStructure.forEach((element, elIndex) => {
      if (!element || typeof element !== 'object') {
        logger.error(
          `[${sourceNameForLog}] Item at articleStructure[${elIndex}] is not an object.`
        );
        isValid = false;
        return; // Continue to next element in forEach
      }
      if (
        !element.elementName ||
        typeof element.elementName !== 'string' ||
        element.elementName.trim() === ''
      ) {
        logger.error(
          `[${sourceNameForLog}] Missing, invalid or empty 'elementName' in articleStructure[${elIndex}].`
        );
        isValid = false;
      }
      if (
        !element.selector ||
        typeof element.selector !== 'string' ||
        element.selector.trim() === ''
      ) {
        logger.error(
          `[${sourceNameForLog}] Missing, invalid, or empty 'selector' in articleStructure[${elIndex}] for elementName '${element.elementName}'.`
        );
        isValid = false;
      }
      // Basic CSS selector validation can be done with isValidCSSSelector from @daitanjs/utilities if needed,
      // but for complex selectors, it's hard. The current check is for emptiness.
    });
  }

  // Validate linkPosition if present
  if (
    source.linkPosition &&
    !['relative', 'absolute'].includes(source.linkPosition)
  ) {
    logger.error(
      `[${sourceNameForLog}] Invalid linkPosition: "${source.linkPosition}". Must be 'relative' or 'absolute'.`
    );
    isValid = false;
  }

  if (isValid) {
    logger.debug(`[${sourceNameForLog}] Source configuration appears valid.`);
  } else {
    // Error already logged for specific issues.
    // logger.error(`[${sourceNameForLog}] Source configuration has one or more errors. Review details above.`);
  }
  return isValid;
}

/**
 * Validates all source configurations from headlines_mongo's SOURCES.
 * Logs errors for invalid configurations.
 * @returns {boolean} True if ALL source configurations are valid, false otherwise.
 */
export function validateAllSourceConfigs() {
  logger.info('🔍 Validating all source configurations for headlines_mongo...');
  if (!Array.isArray(SOURCES) || SOURCES.length === 0) {
    logger.error(
      'SOURCES array is not defined or is empty in config/sources.js. Cannot validate.'
    );
    return false;
  }

  let allConfigsValid = true;
  SOURCES.forEach((source, index) => {
    if (!validateSingleSource(source, index)) {
      allConfigsValid = false; // Individual errors logged by validateSingleSource
    }
  });

  if (allConfigsValid) {
    logger.info('✅ All source configurations passed validation.');
  } else {
    logger.error(
      '❌ One or more source configurations are invalid. Please check the logs above for details. The application might not behave as expected for misconfigured sources.'
    );
  }
  return allConfigsValid;
}
