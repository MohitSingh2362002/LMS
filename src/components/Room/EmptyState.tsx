import React, { useState } from 'react';
import { Copy, Check, Users } from 'lucide-react';

interface EmptyStateProps {
  roomName: string;
}

export function EmptyState({ roomName }: EmptyStateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-surface-800/60 border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full shadow-xl">
        <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Users size={28} className="text-brand-400" />
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Waiting for others…</h3>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          You're the only one here. Share the room name with others to get started.
        </p>
        <div className="flex items-center gap-2 bg-surface-900/80 border border-white/10 rounded-xl px-4 py-3">
          <code className="flex-1 text-brand-300 font-mono text-sm text-left truncate">{roomName}</code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium transition-colors flex-shrink-0"
          >
            {copied ? (
              <>
                <Check size={13} className="text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
