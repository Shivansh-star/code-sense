/**
 * IngestPanel.jsx
 *
 * Top-bar component that accepts a GitHub URL and triggers ingestion.
 * Shows status badges (idle / loading / success / error).
 */

import { useState } from 'react';
import { GitBranch, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function IngestPanel({ onIngest, status, ingestInfo, ingestError }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) onIngest(url.trim());
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-surface-1 border-b border-surface-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Icon */}
        <GitBranch size={18} className="text-accent flex-shrink-0" />

        {/* URL Input */}
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repository"
          className="
            flex-1 min-w-0 bg-surface-2 border border-surface-3
            text-gray-200 text-sm rounded-lg px-3 py-2
            placeholder-gray-500 focus:outline-none focus:border-accent
            transition-colors duration-150 font-mono
          "
          disabled={status === 'loading'}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={status === 'loading' || !url.trim()}
          className="
            flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            bg-accent text-gray-900 hover:bg-accent-hover
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150 flex-shrink-0
          "
        >
          {status === 'loading' ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          {status === 'loading' ? 'Ingesting…' : 'Ingest Repo'}
        </button>
      </form>

      {/* Status strip */}
      {status === 'loading' && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5 pl-1">
          <Loader2 size={12} className="animate-spin text-accent" />
          Cloning, parsing, embedding… this may take a minute for large repos.
        </p>
      )}

      {status === 'success' && ingestInfo && (
        <p className="text-xs text-success flex items-center gap-1.5 pl-1">
          <CheckCircle size={12} />
          Indexed <strong>{ingestInfo.chunksIndexed}</strong> chunks
          {ingestInfo.filesProcessed ? (
            <> from <strong>{ingestInfo.filesProcessed}</strong> files</>
          ) : null}
          .
        </p>
      )}

      {status === 'error' && ingestError && (
        <p className="text-xs text-danger flex items-center gap-1.5 pl-1">
          <AlertCircle size={12} />
          {ingestError}
        </p>
      )}
    </div>
  );
}
