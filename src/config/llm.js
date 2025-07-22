// src/config/llm.js
import { getEnvVariable } from './env.js'; // Assuming your central getEnvVariable

export const LLM_PROVIDER = getEnvVariable('LLM_PROVIDER', 'openai'); // 'openai', 'groq'

// --- OpenAI Settings ---
export const OPENAI_CONFIG = {
  MODEL: getEnvVariable('OPENAI_MODEL', 'gpt-4o-mini'),
  API_KEY: getEnvVariable('OPENAI_API_KEY', null, LLM_PROVIDER === 'openai'), // Required if OpenAI is provider
};

// --- Groq Settings ---
export const GROQ_CONFIG = {
  MODEL: getEnvVariable('GROQ_MODEL', 'llama-3.3-70b-versatile'), // Your desired Groq model
  API_KEY: getEnvVariable('GROQ_API_KEY', null, LLM_PROVIDER === 'groq'), // Required if Groq is provider
  BASE_URL: 'https://api.groq.com/openai/v1',
};

// --- Active LLM Configuration ---
// This selects the configuration to use based on LLM_PROVIDER
let activeLlmConfig;
let activeModel;
let activeApiKey;
let activeBaseURL = null; // Default to null, ChatOpenAI handles OpenAI default

switch (LLM_PROVIDER.toLowerCase()) {
  case 'groq':
    activeModel = GROQ_CONFIG.MODEL;
    activeApiKey = GROQ_CONFIG.API_KEY;
    activeBaseURL = GROQ_CONFIG.BASE_URL;
    if (!activeApiKey) {
      console.warn(
        "LLM_PROVIDER is 'groq' but GROQ_API_KEY is not set. `generateIntelligence` might fail."
      );
    }
    break;
  case 'openai':
  default: // Default to OpenAI
    activeModel = OPENAI_CONFIG.MODEL;
    activeApiKey = OPENAI_CONFIG.API_KEY;
    // activeBaseURL remains null for OpenAI unless a specific proxy is needed
    if (!activeApiKey) {
      console.warn(
        "LLM_PROVIDER is 'openai' or default, but OPENAI_API_KEY is not set. `generateIntelligence` might fail."
      );
    }
    break;
}

export const ACTIVE_LLM_MODEL = activeModel;
export const ACTIVE_LLM_API_KEY = activeApiKey;
export const ACTIVE_LLM_BASE_URL = activeBaseURL;

// Log the active provider
const llmConfigLogger = getLogger('config-llm'); // Use your getLogger
llmConfigLogger.info(`🚀 LLM Provider Active: ${LLM_PROVIDER.toUpperCase()}`);
llmConfigLogger.info(`   Model: ${ACTIVE_LLM_MODEL}`);
llmConfigLogger.info(`   API Key Set: ${!!ACTIVE_LLM_API_KEY}`);
if (ACTIVE_LLM_BASE_URL) {
  llmConfigLogger.info(`   Base URL: ${ACTIVE_LLM_BASE_URL}`);
}
