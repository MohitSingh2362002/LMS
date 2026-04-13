import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import clsx from 'clsx';
import { useChatMessages } from '../../hooks/useChatMessages';
import { Avatar } from '../shared/Avatar';

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const { messages, sendChatMessage, clearUnread, bottomRef } = useChatMessages();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (open) clearUnread();
  }, [open, messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(input.trim());
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={clsx(
        'fixed top-0 right-0 bottom-0 w-80 bg-surface-900 border-l border-white/10 flex flex-col z-30 shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-semibold">Chat</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-white/30 text-sm mt-8">
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Say hello! 👋</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2.5 animate-fade-in">
            <Avatar name={msg.senderName} size="sm" className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-white text-xs font-semibold truncate">{msg.senderName}</span>
                <span className="text-white/30 text-[10px] flex-shrink-0">{formatTime(msg.timestamp)}</span>
              </div>
              <p className="text-white/80 text-sm break-words leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-white/10">
        <div className="flex gap-2 bg-surface-800 border border-white/10 rounded-xl p-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 bg-transparent text-white text-sm px-3 py-2 resize-none focus:outline-none placeholder-white/25 max-h-24 overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg transition-colors self-end"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
