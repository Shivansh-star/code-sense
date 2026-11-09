/**
 * inspect-embeddings.js
 *
 * Inspects the embeddings stored in ChromaDB for the active repository.
 * Run: node scripts/inspect-embeddings.js
 */

import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ path: 'http://localhost:8000' });

async function viewEmbeddings() {
  try {
    const collection = await client.getOrCreateCollection({ name: 'codesense_repo' });
    const count = await collection.count();

    console.log('===============================================================');
    console.log('🔬 CHROMADB EMBEDDINGS INSPECTOR');
    console.log('===============================================================');
    console.log(`Collection Name : ${collection.name}`);
    console.log(`Total Chunks    : ${count}\n`);

    if (count === 0) {
      console.log('No chunks found. Please ingest a repository first.');
      return;
    }

    // Retrieve chunks with their actual embedding vectors
    const data = await collection.get({
      include: ['embeddings', 'metadatas', 'documents'],
    });

    data.ids.forEach((id, i) => {
      const vector = data.embeddings[i];
      const meta = data.metadatas[i];
      const doc = data.documents[i];

      console.log(`---------------------------------------------------------------`);
      console.log(`Chunk #${i + 1}: ${meta.functionName || id}`);
      console.log(`File     : ${meta.filePath} (lines ${meta.startLine}-${meta.endLine})`);
      console.log(`Node Type: ${meta.nodeType}`);
      console.log(`Vector Dimensions: ${vector.length} floats (all-MiniLM-L6-v2)`);
      console.log(`Vector Preview (first 8 floats):`);
      console.log(`   [ ${vector.slice(0, 8).map(v => v.toFixed(6)).join(', ')}, ... ]`);
      console.log(`Code Preview:`);
      const codeLines = doc.trim().split('\n').slice(0, 3).map(l => '   | ' + l).join('\n');
      console.log(codeLines);
      if (doc.trim().split('\n').length > 3) console.log('   | ...');
    });

    console.log('\n===============================================================');
    console.log('📁 Raw files on disk: backend/chroma_data/');
    console.log('===============================================================');
  } catch (err) {
    console.error('Error fetching embeddings:', err.message);
  }
}

viewEmbeddings();
