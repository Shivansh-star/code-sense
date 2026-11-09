
import { pipeline, env } from '@xenova/transformers';

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
 *
 * @param {string | string[]} texts  A single string or array of strings.
 * @returns {Promise<number[][]>}    Array of embedding vectors (plain JS arrays).
 */
export async function embed(texts) {
  const extractor = await getPipeline();
  const inputs = Array.isArray(texts) ? texts : [texts];
  const allVectors = [];

  // Process in batches to avoid memory spikes
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);

    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });

    // output is a Tensor of shape [batchSize, hiddenSize] when pooling='mean'
    // Flatten to individual arrays
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
