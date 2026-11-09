/**
 * CodeViewer.jsx
 *
 * Right panel: Monaco Editor-based code viewer.
 * Displays the currently selected code snippet with:
 *  - Syntax highlighting (language auto-detected from file extension)
 *  - File path breadcrumb + line range badge at the top
 *  - Read-only mode
 *  - Dark "GitHub Dark" theme that matches the app
 */

import Editor from '@monaco-editor/react';
import { FileCode2, Hash } from 'lucide-react';

// Map file extensions → Monaco language identifiers
function detectLanguage(filePath) {
  if (!filePath) return 'javascript';
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
  };
  return map[ext] ?? 'plaintext';
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center">
        <FileCode2 size={24} className="text-gray-500" />
      </div>
      <div>
        <p className="text-gray-500 font-medium text-sm">No snippet selected</p>
        <p className="text-gray-600 text-xs mt-1">
          Click a cited snippet in a chat response to view it here.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CodeViewer({ snippet }) {
  const language = detectLanguage(snippet?.filePath);

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-0">
      {/* ── Header breadcrumb ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-1 border-b border-surface-3 min-h-[44px]">
        {snippet ? (
          <>
            <FileCode2 size={14} className="text-accent flex-shrink-0" />
            <span className="text-xs font-mono text-gray-300 truncate flex-1">
              {snippet.filePath}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-gray-500 flex-shrink-0">
              <Hash size={10} />
              L{snippet.startLine}–{snippet.endLine}
            </span>
            <span className="text-xs bg-surface-2 border border-surface-3 text-gray-400 px-2 py-0.5 rounded font-mono flex-shrink-0">
              {snippet.functionName}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-600 italic">Code Viewer</span>
        )}
      </div>

      {/* ── Monaco Editor / Empty state ────────────────────────────────────── */}
      {snippet ? (
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language}
            value={snippet.code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'none',
              contextmenu: false,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
