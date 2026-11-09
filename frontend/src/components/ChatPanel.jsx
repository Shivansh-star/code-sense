/**
 * ChatPanel.jsx
 *
 * Left panel: full-height chat interface.
 * - Scrollable message history
 * - Typing indicator while waiting for LLM
 * - Message input with send-on-Enter support
 */

import { useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import ChatMessage from './ChatMessage.jsx';

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-2 border border-accent/40 flex items-center justify-center flex-shrink-0">
        <div className="text-accent text-xs">AI</div>
      </div>
      <div className="bg-surface-1 border border-surface-3 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center">
        <MessageSquare size={24} className="text-accent" />
      </div>
      <div>
        <p className="text-gray-300 font-medium text-sm">Paste a GitHub URL above</p>
        <p className="text-gray-500 text-xs mt-1 max-w-xs">
          After ingestion, ask anything about the codebase — architecture, specific
          functions, patterns, authentication flows, and more.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
        {[
          'Where is the authentication middleware?',
          'Explain how API routes are organized',
          'What does the fetchData function do?',
        ].map((hint) => (
          <div
            key={hint}
            className="text-xs text-gray-500 bg-surface-1 border border-surface-3 rounded-lg px-3 py-2 text-left italic"
          >
            "{hint}"
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatPanel({
  messages,
  chatLoading,
  onSend,
  onSnippetSelect,
  activeSnippet,
  ingestStatus,
}) {
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const formRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const value = inputRef.current?.value?.trim();
    if (value && !chatLoading) {
      onSend(value);
      inputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const canChat = ingestStatus === 'success';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Message list ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onSnippetSelect={onSnippetSelect}
              activeSnippet={activeSnippet}
            />
          ))
        )}
        {chatLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <div className="border-t border-surface-3 px-4 py-3 bg-surface-1">
        <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            disabled={!canChat || chatLoading}
            placeholder={
              canChat
                ? 'Ask about the codebase… (Enter to send)'
                : 'Ingest a repository first to start chatting'
            }
            onKeyDown={handleKeyDown}
            className="
              flex-1 resize-none bg-surface-2 border border-surface-3
              text-gray-200 text-sm rounded-xl px-3 py-2.5
              placeholder-gray-600 focus:outline-none focus:border-accent
              transition-colors duration-150 max-h-32
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            style={{ lineHeight: '1.5' }}
          />
          <button
            type="submit"
            disabled={!canChat || chatLoading}
            className="
              w-10 h-10 rounded-xl bg-accent flex items-center justify-center
              hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150 flex-shrink-0
            "
          >
            <Send size={16} className="text-gray-900" />
          </button>
        </form>
      </div>
    </div>
  );
}
