/**
 * ChatMessage.jsx
 *
 * Renders a single chat message with role-aware styling.
 * Assistant messages get:
 *  - Full markdown rendering via react-markdown + remark-gfm
 *  - A "Cited Snippets" accordion showing the retrieved code chunks
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, AlertTriangle, ChevronDown, ChevronUp, Code2 } from 'lucide-react';

// ─── Snippet card ─────────────────────────────────────────────────────────────

function SnippetCard({ snippet, onSelect, isActive }) {
  return (
    <button
      onClick={() => onSelect(snippet)}
      className={`
        w-full text-left px-3 py-2 rounded-lg border text-xs font-mono
        transition-all duration-150
        ${isActive
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-surface-3 bg-surface-0 text-gray-400 hover:border-gray-500 hover:text-gray-300'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          <span className="text-gray-500">{snippet.nodeType}</span>
          {' '}
          <span className={isActive ? 'text-accent' : 'text-gray-300'}>
            {snippet.functionName}
          </span>
        </span>
        <span className={`flex-shrink-0 ${isActive ? 'text-accent' : 'text-gray-500'}`}>
          {Math.round(snippet.relevanceScore * 100)}%
        </span>
      </div>
      <div className="truncate mt-0.5 text-gray-500">
        {snippet.filePath} · L{snippet.startLine}–{snippet.endLine}
      </div>
    </button>
  );
}

// ─── Message types ────────────────────────────────────────────────────────────

function SystemMessage({ content }) {
  return (
    <div className="flex justify-center animate-slide-in">
      <div className="max-w-xl bg-surface-2 border border-surface-3 rounded-lg px-4 py-2.5 text-xs text-gray-400">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end gap-3 animate-slide-in">
      <div className="max-w-[75%] bg-accent-muted border border-accent/30 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-gray-200">
        {content}
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center">
        <User size={14} className="text-gray-400" />
      </div>
    </div>
  );
}

function AssistantMessage({ content, snippets, onSnippetSelect, activeSnippet }) {
  const [showSnippets, setShowSnippets] = useState(false);

  return (
    <div className="flex gap-3 animate-slide-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2 border border-accent/40 flex items-center justify-center">
        <Bot size={14} className="text-accent" />
      </div>

      <div className="flex-1 min-w-0">
        {/* Markdown response */}
        <div className="prose-codesense">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>

        {/* Cited snippets accordion */}
        {snippets?.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowSnippets(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Code2 size={12} />
              {snippets.length} cited snippet{snippets.length > 1 ? 's' : ''}
              {showSnippets ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showSnippets && (
              <div className="mt-2 grid gap-1.5">
                {snippets.map(s => (
                  <SnippetCard
                    key={s.id}
                    snippet={s}
                    onSelect={onSnippetSelect}
                    isActive={activeSnippet?.id === s.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorMessage({ content }) {
  return (
    <div className="flex justify-center animate-slide-in">
      <div className="max-w-xl bg-red-900/20 border border-danger/40 rounded-lg px-4 py-2.5 text-xs text-danger flex items-start gap-2">
        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
        <span>{content}</span>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ChatMessage({ message, onSnippetSelect, activeSnippet }) {
  switch (message.role) {
    case 'system':
      return <SystemMessage content={message.content} />;
    case 'user':
      return <UserMessage content={message.content} />;
    case 'assistant':
      return (
        <AssistantMessage
          content={message.content}
          snippets={message.snippets}
          onSnippetSelect={onSnippetSelect}
          activeSnippet={activeSnippet}
        />
      );
    case 'error':
      return <ErrorMessage content={message.content} />;
    default:
      return null;
  }
}
