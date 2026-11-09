/**
 * chat.route.js
 *
 * POST /api/chat
 *
 * Body: { "question": "Where is the authentication middleware?" }
 *
 * Pipeline:
 *  1. Validate the question.
 *  2. Embed the question locally using @xenova/transformers.
 *  3. Query ChromaDB for the top-4 semantically similar code chunks.
 *  4. Build a grounded RAG prompt and call Gemini.
 *  5. Return { llm_response, cited_code_snippets }.
 */

import { Router } from 'express';
import { embedOne } from '../services/embedding.service.js';
import { querySimilar } from '../services/vectorstore.service.js';
import { generateAnswer } from '../services/llm.service.js';

const router = Router();

const TOP_K = 4; // Number of chunks to retrieve

router.post('/', async (req, res) => {
  const { question } = req.body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: '"question" is required in the request body.' });
  }

  console.log(`\n[chat] Question: "${question}"`);

  try {
    // ── Step 1: Embed the question ─────────────────────────────────────────────
    const queryVector = await embedOne(question.trim());
    console.log(`[chat] Embedded query (dim=${queryVector.length}).`);

    // ── Step 2: Retrieve relevant chunks ──────────────────────────────────────
    const snippets = await querySimilar(queryVector, TOP_K);
    console.log(`[chat] Retrieved ${snippets.length} code snippets.`);

    if (snippets.length === 0) {
      return res.json({
        llm_response:
          'No relevant code was found in the indexed repository. ' +
          'Please ingest a repository first using the ingest panel.',
        cited_code_snippets: [],
      });
    }

    // ── Step 3: Generate answer via Gemini ────────────────────────────────────
    const llmResponse = await generateAnswer(question.trim(), snippets);
    console.log('[chat] ✅ LLM response received.');

    // ── Step 4: Return structured response ────────────────────────────────────
    return res.json({
      llm_response: llmResponse,
      cited_code_snippets: snippets.map(s => ({
        id:           s.id,
        code:         s.code,
        filePath:     s.filePath,
        functionName: s.functionName,
        nodeType:     s.nodeType,
        startLine:    s.startLine,
        endLine:      s.endLine,
        relevanceScore: parseFloat((1 - s.distance).toFixed(4)),
      })),
    });
  } catch (err) {
    console.error('[chat] ❌ Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
