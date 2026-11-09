import { useState, useCallback, useRef, useEffect } from 'react';
import { ingestRepo, askQuestion, getIngestStatus } from '../api.js';

/**
 * useCodeSense
 *
 * Central state machine for the CodeSense UI.
 * Manages: ingestion status, chat history, and the active code snippet.
 */
export function useCodeSense() {
  // ── Ingest state ────────────────────────────────────────────────────────────
  const [ingestStatus, setIngestStatus] = useState('idle'); // idle | loading | success | error
  const [ingestInfo, setIngestInfo] = useState(null);       // { filesProcessed, chunksIndexed, repoUrl }
  const [ingestError, setIngestError] = useState('');

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);             // { role, content, snippets?, id }
  const [chatLoading, setChatLoading] = useState(false);

  // ── Code viewer state ────────────────────────────────────────────────────────
  const [activeSnippet, setActiveSnippet] = useState(null); // The snippet shown in Monaco

  const messageIdRef = useRef(0);
  const nextId = () => ++messageIdRef.current;

  // On page mount, check if ChromaDB already has an ingested repo
  useEffect(() => {
    getIngestStatus()
      .then((data) => {
        if (data.ingested && data.chunksIndexed > 0) {
          setIngestStatus('success');
          setIngestInfo({ chunksIndexed: data.chunksIndexed });
          setMessages([
            {
              id: nextId(),
              role: 'system',
              content: `ℹ️ **Previous session restored!**  
**${data.chunksIndexed}** code chunks are already indexed in ChromaDB.  
You can ask questions immediately or ingest a new repo above.`,
            },
          ]);
        }
      })
      .catch(() => {
        // backend might still be spinning up, ignore
      });
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleIngest = useCallback(async (repoUrl) => {
    setIngestStatus('loading');
    setIngestError('');
    setIngestInfo(null);
    setMessages([]);
    setActiveSnippet(null);

    try {
      const result = await ingestRepo(repoUrl);
      setIngestInfo({ ...result, repoUrl });
      setIngestStatus('success');
      setMessages([{
        id: nextId(),
        role: 'system',
        content: `✅ **Repository ingested!**  
\`${repoUrl}\`  
**${result.filesProcessed}** files processed · **${result.chunksIndexed}** code chunks indexed.  
You can now ask questions about this codebase.`,
      }]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Ingestion failed.';
      setIngestError(msg);
      setIngestStatus('error');
    }
  }, []);

  const handleChat = useCallback(async (question) => {
    if (!question.trim()) return;

    // Append user message immediately for snappy UX
    const userMsg = { id: nextId(), role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const result = await askQuestion(question);
      const assistantMsg = {
        id: nextId(),
        role: 'assistant',
        content: result.llm_response,
        snippets: result.cited_code_snippets,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Auto-open the top snippet in the code viewer
      if (result.cited_code_snippets?.length > 0) {
        setActiveSnippet(result.cited_code_snippets[0]);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Chat request failed.';
      setMessages(prev => [
        ...prev,
        { id: nextId(), role: 'error', content: msg },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  return {
    // Ingest
    ingestStatus,
    ingestInfo,
    ingestError,
    handleIngest,
    // Chat
    messages,
    chatLoading,
    handleChat,
    // Code viewer
    activeSnippet,
    setActiveSnippet,
  };
}
