// src/pipeline/1_preflight.js (version 1.1)
import { logger } from '../utils/logger.js'
import { connectDatabase } from '../database.js'
import { performAiSanityCheck, checkModelPermissions } from '../modules/ai/index.js'
import { LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES } from '../config/index.js'
import { initializeConfig } from '../config/dynamicConfig.js'

/**
 * Stage 1: Performs pre-flight checks, connects to the database, and initializes dynamic config.
 * @param {object} pipelinePayload - The main pipeline payload object.
 * @returns {Promise<{success: boolean, payload: object}>}
 */
export async function runPreFlightChecks(pipelinePayload) {
  logger.info('--- STAGE 1: PRE-FLIGHT ---')

  // AI Sanity Checks
  const requiredModels = [...new Set([LLM_MODEL_TRIAGE, LLM_MODEL_ARTICLES])]
  if (!(await performAiSanityCheck()) || !(await checkModelPermissions(requiredModels))) {
    logger.fatal('AI service checks failed. Aborting pipeline.')
    return { success: false, payload: pipelinePayload }
  }

  // Database Connection
  const isDbConnected = await connectDatabase()
  if (!isDbConnected) {
    logger.fatal('Database connection failed. Aborting pipeline.')
    return { success: false, payload: pipelinePayload }
  }
  pipelinePayload.dbConnection = true

  // Dynamic Configuration Initialization from Database
  await initializeConfig()

  return { success: true, payload: pipelinePayload }
}
