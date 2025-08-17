// src/config/dynamicConfig.js (version 1.0)
import Source from '../../models/Source.js'
import { logger } from '../utils/logger.js'

export const configStore = {
  newspaperToCountryMap: new Map(),
  countryNameToFlagMap: new Map(),
}

const COUNTRY_FLAG_MAP = {
  Denmark: '🇩🇰',
  Norway: '🇳🇴',
  Sweden: '🇸🇪',
  Finland: '🇫🇮',
  Netherlands: '🇳🇱',
  'Global PE': '🌐',
  'M&A Aggregators': '🤝',
}

let isInitialized = false

/**
 * Connects to the database, fetches all sources, and builds the global
 * configuration maps needed by various pipeline stages.
 */
export async function initializeConfig() {
  if (isInitialized) {
    return
  }
  try {
    logger.info('Initializing dynamic configuration from database...')
    const sources = await Source.find().lean()

    if (sources.length === 0) {
      logger.warn(
        'No sources found in the database. Configuration maps will be empty. Did you run the migration script?'
      )
    }

    for (const source of sources) {
      configStore.newspaperToCountryMap.set(source.name, source.country)
      if (
        !configStore.countryNameToFlagMap.has(source.country) &&
        COUNTRY_FLAG_MAP[source.country]
      ) {
        configStore.countryNameToFlagMap.set(
          source.country,
          COUNTRY_FLAG_MAP[source.country]
        )
      }
    }

    isInitialized = true
    logger.info(
      `Dynamic configuration initialized successfully. Loaded ${sources.length} sources.`
    )
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to initialize dynamic configuration from DB.')
    throw error // Propagate error to halt the pipeline
  }
}
