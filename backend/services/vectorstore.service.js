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

function getClient() {
  if (!_client) {
    // ChromaDB JS client ≥1.9 uses `host` + `port` separately (or a full `path`)
    _client = new ChromaClient({ path: CHROMA_HOST });
  }
  return _client;
}

/**
 * Test connectivity to ChromaDB — throws a friendly error if unreachable.
 */
export async function checkConnection() {
  const client = getClient();
  try {
    await client.heartbeat();
  } catch (err) {
    throw new Error(
      'Cannot reach ChromaDB at ' + CHROMA_HOST + '. ' +
      'Start it with: python -m chromadb.cli.cli run --host localhost --port 8000'
    );
  }
}

/**
 * Return collection statistics (e.g. number of indexed chunks).
 */
export async function getCollectionStats() {
  const collection = await getOrCreateCollection();
  const count = await collection.count();
  return { count };
}

/**
 * Return (or create) the shared collection.
 * ChromaDB collections are schema-less; we just pass embeddings as arrays.
 */
export async function getOrCreateCollection() {
  if (_collection) return _collection;

  const client = getClient();
  _collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { 'hnsw:space': 'cosine' },
  });

  console.log(`[vectorstore] Collection "${COLLECTION_NAME}" ready.`);
  return _collection;
}

/**
 * Delete and recreate the collection to start a fresh ingest.
 */
export async function resetCollection() {
  const client = getClient();
  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
    console.log(`[vectorstore] Deleted old collection "${COLLECTION_NAME}".`);
  } catch {
    // Collection may not exist yet – that's fine
  }
  _collection = null;
  return getOrCreateCollection();
}

/**
 * Upsert an array of code chunks with their precomputed embeddings.
 *
 * @param {Array<{
 *   id:           string,
 *   code:         string,
 *   filePath:     string,
 *   functionName: string,
 *   nodeType:     string,
 *   startLine:    number,
 *   endLine:      number,
 * }>} chunks
 *
 * @param {number[][]} embeddings  One vector per chunk (same order).
 */
export async function upsertChunks(chunks, embeddings) {
  const collection = await getOrCreateCollection();

  const ids = chunks.map(c => c.id);
  const documents = chunks.map(c => c.code);
  const metadatas = chunks.map(c => ({
    filePath:     c.filePath,
    functionName: c.functionName,
    nodeType:     c.nodeType,
    startLine:    c.startLine,
    endLine:      c.endLine,
  }));

  // ChromaDB's upsert handles duplicate IDs gracefully
  await collection.upsert({
    ids,
    embeddings,
    documents,
    metadatas,
  });

  console.log(`[vectorstore] Upserted ${chunks.length} chunks.`);
}

/**
 * Query for the k most similar code chunks.
 *
 * @param {number[]} queryEmbedding  The query vector.
 * @param {number}   k              Number of results to return.
 * @returns {Promise<Array<{
 *   id:           string,
 *   code:         string,
 *   filePath:     string,
 *   functionName: string,
 *   nodeType:     string,
 *   startLine:    number,
 *   endLine:      number,
 *   distance:     number,
 * }>>}
 */
export async function querySimilar(queryEmbedding, k = 4) {
  const collection = await getOrCreateCollection();

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
    include: ['documents', 'metadatas', 'distances'],
  });

  const ids       = results.ids[0]       ?? [];
  const documents = results.documents[0] ?? [];
  const metadatas = results.metadatas[0] ?? [];
  const distances = results.distances[0] ?? [];

  return ids.map((id, i) => ({
    id,
    code:         documents[i],
    filePath:     metadatas[i]?.filePath     ?? '',
    functionName: metadatas[i]?.functionName ?? '',
    nodeType:     metadatas[i]?.nodeType     ?? '',
    startLine:    metadatas[i]?.startLine    ?? 0,
    endLine:      metadatas[i]?.endLine      ?? 0,
    distance:     distances[i],
  }));
}
