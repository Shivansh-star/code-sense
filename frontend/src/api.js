/**
 * api.js
 * Axios instance + typed API helpers for the CodeSense backend.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://codesense-backend-5kk2.onrender.com', // Render wala URL
  timeout: 300_000,
});

/**
 * Ingest a GitHub repository.
 * @param {string} repoUrl
 * @returns {Promise<{message: string, filesProcessed: number, chunksIndexed: number}>}
 */
export async function ingestRepo(repoUrl) {
  const { data } = await api.post('/ingest', { repoUrl });
  return data;
}

/**
 * Check if a repository is already indexed.
 * @returns {Promise<{ingested: boolean, chunksIndexed: number}>}
 */
export async function getIngestStatus() {
  const { data } = await api.get('/ingest/status');
  return data;
}

/**
 * Send a chat question and get a RAG-grounded answer.
 * @param {string} question
 * @returns {Promise<{
 *   llm_response: string,
 *   cited_code_snippets: Array<{
 *     id: string,
 *     code: string,
 *     filePath: string,
 *     functionName: string,
 *     nodeType: string,
 *     startLine: number,
 *     endLine: number,
 *     relevanceScore: number,
 *   }>
 * }>}
 */
export async function askQuestion(question) {
  const { data } = await api.post('/chat', { question });
  return data;
}

export default api;
