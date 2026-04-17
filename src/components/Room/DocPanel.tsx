import React, { useMemo, useState } from 'react';
import { X, FileText, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { SharedDocState } from '../../types';
import { uploadSessionDoc } from '../../api/docApi';

interface DocPanelProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  doc: SharedDocState | null;
  onOpenDoc: (url: string, title: string) => void;
  onCloseDocForAll: () => void;
}

function normalizeDocUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function DocPanel({ open, onClose, isHost, doc, onOpenDoc, onCloseDocForAll }: DocPanelProps) {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const normalizedUrl = useMemo(() => normalizeDocUrl(urlInput), [urlInput]);

  const handleOpenDoc = () => {
    if (!normalizedUrl) return;
    onOpenDoc(normalizedUrl, titleInput.trim() || 'Session Document');
    setTitleInput('');
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadSessionDoc(file);
      onOpenDoc(uploaded.url, uploaded.title || file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={clsx(
        'fixed top-0 right-0 bottom-0 w-[420px] bg-surface-900 border-l border-white/10 flex flex-col z-30 shadow-2xl transition-transform duration-300',
        'w-full max-w-[420px]',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-brand-300" />
          <h2 className="text-white font-semibold">Shared Document</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 border-b border-white/10 space-y-2">
        {isHost && (
          <>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste doc URL (Google Docs, Notion, etc.)"
              className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            />
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Optional title"
              className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            />
            <div className="flex gap-2">
              <button
                onClick={handleOpenDoc}
                disabled={!normalizedUrl}
                className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Open for everyone
              </button>
              {doc && (
                <button
                  onClick={onCloseDocForAll}
                  className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-300 text-sm"
                >
                  Close
                </button>
              )}
            </div>
            <label className="block">
              <span className="text-white/60 text-xs">Or share a local file from your system</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf,.csv,.xlsx,.xls,.odt,.odp,.ods,image/*"
                onChange={handleFilePicked}
                disabled={uploading}
                className="mt-1.5 block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-white file:cursor-pointer"
              />
            </label>
            {uploading && <p className="text-xs text-brand-300">Uploading file...</p>}
            {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}
          </>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {!doc ? (
          <div className="h-full flex items-center justify-center px-6 text-center">
            <p className="text-white/50 text-sm">
              {isHost ? 'Open a document URL to share it with all participants.' : 'No shared document is open yet.'}
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{doc.title}</p>
                <p className="text-white/40 text-xs truncate">{doc.url}</p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                title="Open in new tab"
              >
                <ExternalLink size={15} />
              </a>
            </div>
            <iframe title={doc.title} src={doc.url} className="w-full h-full bg-white" />
          </div>
        )}
      </div>
    </div>
  );
}
