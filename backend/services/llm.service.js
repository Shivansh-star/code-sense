/**
 * llm.service.js
 *
 * Wraps the Google Gemini API (free tier) to generate natural-language
 * explanations of code, grounded in retrieved snippets.
 *
 * Model used: gemini-3.5-flash-lite (fast, high free quota, long context support).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash'];

let _genAI = null;

function getClient() {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error(
        'GEMINI_API_KEY is not set. Please copy .env.example → .env and add your key.'
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

/**
 * Build the RAG prompt that is sent to Gemini.
 *
 * @param {string} userQuestion   The user's natural language question.
 * @param {Array<{
 *   code:         string,
 *   filePath:     string,
 *   functionName: string,
 *   startLine:    number,
 *   endLine:      number,
 * }>} snippets   Retrieved code chunks (ordered by relevance).
 *
 * @returns {string}
 */
function buildPrompt(userQuestion, snippets) {
  const snippetBlock = snippets
    .map(
      (s, i) =>
        `### Snippet ${i + 1} — \`${s.filePath}\` (lines ${s.startLine}–${s.endLine})\n` +
        `\`\`\`\n${s.code}\n\`\`\``
    )
    .join('\n\n');

  return `You are CodeSense, an expert AI assistant that helps developers understand unfamiliar codebases.

You have been given the following code snippets retrieved from the repository based on the user's question.
Use ONLY these snippets to answer. If the answer cannot be determined from the snippets, say so honestly.
Always reference the file path and line numbers when you explain something.
Format your response in clear, readable Markdown.

---
## Retrieved Code Snippets

${snippetBlock}

---
## User Question

${userQuestion}

---
## Your Answer
`;
}

/**
 * Generate an LLM explanation grounded in the retrieved code snippets.
 *
 * @param {string}   userQuestion
 * @param {Array}    snippets       – output of vectorstore.querySimilar()
 * @returns {Promise<string>}       Markdown-formatted response from Gemini.
 */
export async function generateAnswer(userQuestion, snippets) {
  const genAI = getClient();
  const prompt = buildPrompt(userQuestion, snippets);
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

  let lastError = null;
  for (const modelName of modelsToTry) {
    try {
      console.log(`[llm] Sending prompt to ${modelName} …`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      console.warn(`[llm] Model ${modelName} failed (${err.message}). Trying fallback…`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}
