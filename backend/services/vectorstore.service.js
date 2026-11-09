/**
 * vectorstore.service.js
 *
 * Thin wrapper around the ChromaDB JavaScript client.
 *
 * ChromaDB must be running locally:
 *   docker run -p 8000:8000 chromadb/chroma
 * OR install the Python package and run:
 *   pip install chromadb && chroma run --host localhost --port 8000
 *
 * We expose four operations:
 *  - getOrCreateCollection()  – idempotent setup
 *  - upsertChunks()           – store/overwrite code chunks + embeddings
 *  - querySimilar()           – k-NN search
 *  - deleteCollection()       – wipe before a fresh ingest
 */

import { ChromaClient } from 'chromadb';

const COLLECTION_NAME = 'codesense_repo';
const CHROMA_HOST = process.env.CHROMA_HOST || 'http://localhost:8000';

let _client = null;
let _collection = null;
let _useMemoryStore = false;
let _memoryStore = new Map(); // In-memory fallback if ChromaDB is offline (e.g. on Render)

function getClient() {
  if (!_client) {
    _client = new ChromaClient({ path: CHROMA_HOST });
  }
  return _client;
}

/**
 * Return collection statistics (e.g. number of indexed chunks).
 */
export async function getCollectionStats() {
  if (_useMemoryStore) {
    return { count: _memoryStore.size };
  }

  try {
    const collection = await getOrCreateCollection();
    const count = await collection.count();
    return { count };
  } catch {
    return { count: _memoryStore.size };
  }
}

/**
 * Return (or create) the shared collection.
 */
export async function getOrCreateCollection() {
  if (_useMemoryStore) return null;
  if (_collection) return _collection;

  try {
    const client = getClient();
    _collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 'hnsw:space': 'cosine' },
    });
    console.log(`[vectorstore] ChromaDB collection "${COLLECTION_NAME}" ready.`);
    return _collection;
  } catch (err) {
    console.warn(`[vectorstore] ChromaDB unreachable at ${CHROMA_HOST}. Falling back to in-memory vector store.`);
    _useMemoryStore = true;
    return null;
  }
}

/**
 * Delete and recreate the collection to start a fresh ingest.
 */
export async function resetCollection() {
  _memoryStore.clear();

  if (!_useMemoryStore) {
    try {
      const client = getClient();
      await client.deleteCollection({ name: COLLECTION_NAME });
    } catch {
      // Ignored if collection didn't exist yet
    }
    _collection = null;
    return getOrCreateCollection();
  }
}

/**
 * Upsert an array of code chunks with their precomputed embeddings.
 */
export async function upsertChunks(chunks, embeddings) {
  // Always update memory store
  for (let i = 0; i < chunks.length; i++) {
    _memoryStore.set(chunks[i].id, {
      chunk: chunks[i],
      embedding: embeddings[i],
    });
  }

  const collection = await getOrCreateCollection();
  if (collection) {
    try {
      const ids = chunks.map(c => c.id);
      const documents = chunks.map(c => c.code);
      const metadatas = chunks.map(c => ({
        filePath: c.filePath,
        functionName: c.functionName,
        nodeType: c.nodeType,
        startLine: c.startLine,
        endLine: c.endLine,
      }));

      await collection.upsert({
        ids,
        embeddings,
        documents,
        metadatas,
      });
      console.log(`[vectorstore] Upserted ${chunks.length} chunks to ChromaDB.`);
      return;
    } catch (err) {
      console.warn('[vectorstore] ChromaDB upsert failed, using memory store:', err.message);
    }
  }

  console.log(`[vectorstore] Stored ${chunks.length} chunks in memory store.`);
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Query for the k most similar code chunks.
 */
export async function querySimilar(queryEmbedding, k = 4) {
  const collection = await getOrCreateCollection();
  if (collection) {
    try {
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        include: ['documents', 'metadatas', 'distances'],
      });

      const ids = results.ids[0] ?? [];
      const documents = results.documents[0] ?? [];
      const metadatas = results.metadatas[0] ?? [];
      const distances = results.distances[0] ?? [];

      return ids.map((id, i) => ({
        id,
        code: documents[i],
        filePath: metadatas[i]?.filePath ?? '',
        functionName: metadatas[i]?.functionName ?? '',
        nodeType: metadatas[i]?.nodeType ?? '',
        startLine: metadatas[i]?.startLine ?? 0,
        endLine: metadatas[i]?.endLine ?? 0,
        distance: distances[i],
      }));
    } catch (err) {
      console.warn('[vectorstore] ChromaDB query failed, falling back to memory store:', err.message);
    }
  }

  // Memory store fallback: cosine similarity (dot product on normalized unit vectors)
  const scored = [];
  for (const item of _memoryStore.values()) {
    const sim = dotProduct(queryEmbedding, item.embedding);
    scored.push({
      id: item.chunk.id,
      code: item.chunk.code,
      filePath: item.chunk.filePath,
      functionName: item.chunk.functionName,
      nodeType: item.chunk.nodeType,
      startLine: item.chunk.startLine,
      endLine: item.chunk.endLine,
      distance: 1 - sim,
    });
  }

  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, k);
}
