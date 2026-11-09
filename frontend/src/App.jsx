/**
 * App.jsx
 *
 * Root component for CodeSense.
 * Layout: fixed header → split-pane body (resizable left chat / right code viewer).
 */

import { useState, useCallback, useRef } from 'react';
import { Code2, Github, Zap } from 'lucide-react';

import IngestPanel from './components/IngestPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import CodeViewer from './components/CodeViewer.jsx';
import { useCodeSense } from './hooks/useCodeSense.js';

// ─── Resizable splitter ───────────────────────────────────────────────────────

function useResizablePanels(initialLeftPct = 42) {
  const [leftPct, setLeftPct] = useState(initialLeftPct);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(75, Math.max(25, pct)));
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return { leftPct, containerRef, onMouseDown };
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ ingestInfo }) {
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-surface-1 border-b border-surface-3 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
          <Code2 size={16} className="text-accent" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-100 tracking-tight">CodeSense</h1>
          <p className="text-xs text-gray-500 leading-none">Intelligent Codebase Onboarding</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {ingestInfo && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Github size={12} />
            <span className="font-mono truncate max-w-[200px]">
              {ingestInfo.repoUrl?.replace('https://github.com/', '')}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-400 bg-surface-2 border border-surface-3 px-2 py-1 rounded-full">
          <Zap size={10} className="text-yellow-500" />
          <span>Gemini 3.5 Flash</span>
        </div>
      </div>
    </header>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    ingestStatus, ingestInfo, ingestError, handleIngest,
    messages, chatLoading, handleChat,
    activeSnippet, setActiveSnippet,
  } = useCodeSense();

  const { leftPct, containerRef, onMouseDown } = useResizablePanels(45);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── App header ─────────────────────────────────────────────────────── */}
      <Header ingestInfo={ingestInfo} />

      {/* ── Ingest bar ─────────────────────────────────────────────────────── */}
      <IngestPanel
        onIngest={handleIngest}
        status={ingestStatus}
        ingestInfo={ingestInfo}
        ingestError={ingestError}
      />

      {/* ── Split pane body ────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat panel */}
        <div style={{ width: `${leftPct}%` }} className="flex flex-col min-h-0 border-r border-surface-3">
          <ChatPanel
            messages={messages}
            chatLoading={chatLoading}
            onSend={handleChat}
            onSnippetSelect={setActiveSnippet}
            activeSnippet={activeSnippet}
            ingestStatus={ingestStatus}
          />
        </div>

        {/* Resizer */}
        <div
          className="panel-resizer"
          onMouseDown={onMouseDown}
          title="Drag to resize"
        />

        {/* Right: Code viewer */}
        <div style={{ width: `${100 - leftPct}%` }} className="flex flex-col min-h-0">
          <CodeViewer snippet={activeSnippet} />
        </div>
      </div>
    </div>
  );
}
