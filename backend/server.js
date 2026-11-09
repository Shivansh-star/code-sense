import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import ingestRouter from './routes/ingest.route.js';
import chatRouter from './routes/chat.route.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure the temp cloning directory exists
const cloneDir = process.env.CLONE_DIR || './tmp/repos';
if (!fs.existsSync(cloneDir)) {
  fs.mkdirSync(cloneDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Process crash protection ────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*', // Allow all origins (Vercel, localhost, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes (supports both /api/* and /* paths) ────────────────────────────────
app.use('/api/ingest', ingestRouter);
app.use('/api/chat', chatRouter);
app.use('/ingest', ingestRouter);
app.use('/chat', chatRouter);

// ─── Debug endpoint ───────────────────────────────────────────────────────────
app.get(['/api/debug', '/debug'], async (_req, res) => {
  const info = {
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    nodeVersion: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      RENDER: process.env.RENDER,
      PORT: process.env.PORT,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    },
    steps: {},
  };

  // Test 1: Simple Git
  try {
    const { default: simpleGit } = await import('simple-git');
    const version = await simpleGit().version();
    info.steps.git = { ok: true, version };
  } catch (err) {
    info.steps.git = { ok: false, error: err.message };
  }

  // Test 2: Tree-Sitter
  try {
    const { parseFile } = await import('./services/parser.service.js');
    info.steps.treeSitter = { ok: true };
  } catch (err) {
    info.steps.treeSitter = { ok: false, error: err.message };
  }

  // Test 3: Gemini status & available models
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Try embedding models
    const candidateModels = [
      'gemini-embedding-001',
      'models/gemini-embedding-001',
      'gemini-embedding-2',
      'models/gemini-embedding-2',
      'gemini-embedding-2-preview',
      'text-embedding-005',
    ];
    let works = null;
    let errors = [];
    for (const m of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.embedContent('hello world');
        works = { model: m, dims: res.embedding.values.length };
        break;
      } catch (e) {
        errors.push(`${m}: ${e.message}`);
      }
    }
    info.steps.geminiEmbedding = works || { ok: false, errors };
  } catch (err) {
    info.steps.geminiEmbedding = { ok: false, error: err.message };
  }

  res.json(info);
});

// ─── Test ingest step by step ────────────────────────────────────────────────
app.get(['/api/debug/test-step', '/debug/test-step'], async (req, res) => {
  const step = parseInt(req.query.step || '1', 10);
  const repoUrl = 'https://github.com/Shivansh-star/code-sense';
  const testDir = path.resolve(__dirname, 'tmp', 'test_repo');

  const result = { step, memStart: Math.round(process.memoryUsage().rss / 1024 / 1024) };

  try {
    if (step >= 1) {
      const { default: simpleGit } = await import('simple-git');
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
      fs.mkdirSync(testDir, { recursive: true });
      await simpleGit().clone(repoUrl, testDir, ['--depth', '1']);
      result.step1_clone = 'ok';
    }

    if (step >= 2) {
      const { walkDirectory } = await import('./utils/fileWalker.js');
      const files = walkDirectory(testDir);
      result.step2_files = files.length;
    }

    if (step >= 3) {
      const { walkDirectory } = await import('./utils/fileWalker.js');
      const { parseFile } = await import('./services/parser.service.js');
      const files = walkDirectory(testDir);
      let chunks = [];
      for (const f of files) {
        chunks.push(...parseFile(f, testDir));
      }
      result.step3_chunks = chunks.length;
    }

    if (step >= 4) {
      const { walkDirectory } = await import('./utils/fileWalker.js');
      const { parseFile } = await import('./services/parser.service.js');
      const { embed } = await import('./services/embedding.service.js');
      const files = walkDirectory(testDir);
      let chunks = [];
      for (const f of files) chunks.push(...parseFile(f, testDir));
      const texts = chunks.slice(0, 10).map(c => c.code); // test first 10
      result.memBeforeEmbed = Math.round(process.memoryUsage().rss / 1024 / 1024);
      const embs = await embed(texts);
      result.step4_embeddings = embs.length;
      result.memAfterEmbed = Math.round(process.memoryUsage().rss / 1024 / 1024);
    }

    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 CodeSense backend running on http://localhost:${PORT}`);
  console.log(`   POST /api/ingest  – Ingest a GitHub repo`);
  console.log(`   POST /api/chat    – Ask a question about the repo\n`);
});
