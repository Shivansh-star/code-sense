
import { pipeline, env } from '@xenova/transformers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_EMBED_MODEL = 'gemini-embedding-001';
let _geminiModel = null;

function getGeminiModel() {
  if (!_geminiModel && process.env.GEMINI_API_KEY) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    _geminiModel = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });
  }
  return _geminiModel;
}

// Allow the transformers library to cache models locally.
env.allowLocalModels = true;
env.cacheDir = './models';  // Relative to the backend root

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const BATCH_SIZE = 16;     
let _pipeline = null;       

/**
 * Lazily initialise the feature-extraction pipeline.
 * Prints a friendly message the first time so users know the model
 * is downloading (can be ~23 MB on first run with quantization).
 */
async function getPipeline() {
  if (_pipeline) return _pipeline;

  console.log(`[embedding] Loading model "${MODEL_NAME}" …`);
  console.log('[embedding] ⏳  First run may download ~23 MB – please wait …');

  _pipeline = await pipeline('feature-extraction', MODEL_NAME, {
    quantized: true,
  });

  console.log('[embedding] ✅  Model ready.');
  return _pipeline;
}

/**
 * Embed one or more texts.
 * Uses Gemini gemini-embedding-001 by default (0 MB RAM, fast cloud API),
 * with seamless fallback to local Xenova transformers.
 *
 * @param {string | string[]} texts  A single string or array of strings.
 * @returns {Promise<number[][]>}    Array of embedding vectors (plain JS arrays).
 */
export async function embed(texts) {
  const inputs = Array.isArray(texts) ? texts : [texts];

  // 1. Try Gemini Cloud Embedding (Zero RAM, ideal for cloud hosting like Render)
  const gemini = getGeminiModel();
  if (gemini) {
    try {
      const results = [];
      const PARALLEL_BATCH = 5;
      for (let i = 0; i < inputs.length; i += PARALLEL_BATCH) {
        const batch = inputs.slice(i, i + PARALLEL_BATCH);
        const batchRes = await Promise.all(
          batch.map(async (text) => {
            const cleanText = text.slice(0, 2048);
            const res = await gemini.embedContent(cleanText);
            return res.embedding.values;
          })
        );
        results.push(...batchRes);
      }
      return results;
    } catch (err) {
      console.warn('[embedding] Gemini cloud embedding failed, falling back to local:', err.message);
    }
  }

  // 2. Fallback to local ONNX transformer
  const extractor = await getPipeline();
  const allVectors = [];

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);

    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });

    const [batchSize, hiddenSize] = output.dims;
    for (let b = 0; b < batchSize; b++) {
      const vec = Array.from(output.data.slice(b * hiddenSize, (b + 1) * hiddenSize));
      allVectors.push(vec);
    }
  }

  return allVectors;
}

/**
 * Convenience wrapper: embed a single text and return a single vector.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedOne(text) {
  const [vec] = await embed([text]);
  return vec;
}
