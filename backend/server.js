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

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));  // Vite dev server
app.use(express.json());

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/ingest', ingestRouter);
app.use('/api/chat', chatRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
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
