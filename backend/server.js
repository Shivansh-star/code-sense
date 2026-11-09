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

  // Test 3: Gemini status
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const res = await model.embedContent('function test() { return 1; }');
    info.steps.geminiEmbedding = { ok: true, dims: res.embedding.values.length };
  } catch (err) {
    info.steps.geminiEmbedding = { ok: false, error: err.message };
  }

  res.json(info);
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
