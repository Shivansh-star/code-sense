/**
 * ingest.route.js
 *
 * POST /api/ingest
 *
 * Body: { "repoUrl": "https://github.com/owner/repo" }
 *
 * Pipeline:
 *  1. Validate the GitHub URL.
 *  2. Clone the repository into a temporary directory using simple-git.
 *  3. Walk the directory tree and collect all JS/TS files.
 *  4. Parse each file with tree-sitter to extract semantic code chunks.
 *  5. Embed all chunks locally with @xenova/transformers.
 *  6. Upsert embeddings + metadata into ChromaDB.
 *  7. Clean up the cloned directory.
 *  8. Return a summary.
 */

import { Router } from 'express';
import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { walkDirectory } from '../utils/fileWalker.js';
import { parseFile } from '../services/parser.service.js';
import { embed } from '../services/embedding.service.js';
import { resetCollection, upsertChunks, getCollectionStats } from '../services/vectorstore.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// ─── Utility ──────────────────────────────────────────────────────────────────

function sanitizeRepoName(url) {
  // Extract "owner/repo" from the GitHub URL and make it filesystem-safe
  const match = url.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/i);
  return match ? match[1].replace(/\//g, '__') : `repo_${Date.now()}`;
}

function rmrf(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// ─── Status check ─────────────────────────────────────────────────────────────

router.get('/status', async (_req, res) => {
  try {
    const stats = await getCollectionStats();
    return res.json({
      ingested: stats.count > 0,
      chunksIndexed: stats.count,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { repoUrl } = req.body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'repoUrl is required in the request body.' });
  }
  if (!/^https?:\/\/(www\.)?github\.com\/.+/.test(repoUrl)) {
    return res.status(400).json({ error: 'Only public GitHub URLs are supported.' });
  }

  const repoName = sanitizeRepoName(repoUrl);
  const cloneBaseDir = process.env.CLONE_DIR
    ? path.resolve(process.env.CLONE_DIR)
    : path.resolve(__dirname, '..', 'tmp', 'repos');
  const clonePath = path.join(cloneBaseDir, repoName);

  console.log(`\n[ingest] Starting ingestion for: ${repoUrl}`);

  try {
    // ── Step 1: Clone ──────────────────────────────────────────────────────────
    rmrf(clonePath); // Remove stale clone if exists
    fs.mkdirSync(clonePath, { recursive: true });

    console.log(`[ingest] Cloning into ${clonePath} …`);
    await simpleGit().clone(repoUrl, clonePath, ['--depth', '1']);
    console.log('[ingest] ✅ Clone complete.');

    // ── Step 2: Walk files ─────────────────────────────────────────────────────
    const files = walkDirectory(clonePath);
    console.log(`[ingest] Found ${files.length} supported source files.`);

    if (files.length === 0) {
      rmrf(clonePath);
      return res.status(422).json({
        error: 'No supported source files (.js, .jsx, .ts, .tsx, .py) found in this repository.',
      });
    }

    // ── Step 3: Parse (AST chunking) ───────────────────────────────────────────
    console.log('[ingest] Parsing files with tree-sitter …');
    let allChunks = [];
    for (const file of files) {
      const chunks = parseFile(file, clonePath);
      allChunks.push(...chunks);
    }
    console.log(`[ingest] Extracted ${allChunks.length} semantic chunks.`);

    if (allChunks.length === 0) {
      rmrf(clonePath);
      return res.status(422).json({
        error: 'No parseable function/class declarations found in the repository.',
      });
    }

    // ── Step 4: Embed ──────────────────────────────────────────────────────────
    console.log('[ingest] Embedding chunks locally (this may take a moment) …');
    const texts = allChunks.map(c => `File: ${c.filePath}\n\n${c.code}`);
    const embeddings = await embed(texts);
    console.log(`[ingest] ✅ Generated ${embeddings.length} embeddings.`);

    // ── Step 5: Store in ChromaDB ──────────────────────────────────────────────
    console.log('[ingest] Resetting ChromaDB collection and upserting …');
    await resetCollection();
    await upsertChunks(allChunks, embeddings);
    console.log('[ingest] ✅ Stored in ChromaDB.');

    // ── Step 6: Cleanup ────────────────────────────────────────────────────────
    rmrf(clonePath);
    console.log('[ingest] 🧹 Cleaned up temp directory.');

    // ── Step 7: Respond ────────────────────────────────────────────────────────
    return res.json({
      message: 'Repository ingested successfully.',
      repoUrl,
      filesProcessed: files.length,
      chunksIndexed: allChunks.length,
    });
  } catch (err) {
    rmrf(clonePath);
    console.error('[ingest] ❌ Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
