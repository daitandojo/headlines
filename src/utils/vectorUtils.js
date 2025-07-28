// src/utils/vectorUtils.js
import { pipeline } from '@xenova/transformers';

// Use a singleton pattern to ensure we only load the model once.
class EmbeddingPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

/**
 * Generates an embedding for a given text.
 * @param {string} text The text to embed.
 * @returns {Promise<Array<number>>} A promise that resolves to the embedding vector.
 */
export async function generateEmbedding(text) {
    const extractor = await EmbeddingPipeline.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

/**
 * Calculates the cosine similarity between two vectors.
 * @param {Array<number>} vecA The first vector.
 * @param {Array<number>} vecB The second vector.
 * @returns {number} The cosine similarity score (between -1 and 1).
 */
export function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}