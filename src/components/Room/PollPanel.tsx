import React, { useMemo, useState } from 'react';
import { X, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import { PollState } from '../../types';

interface PollPanelProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  poll: PollState | null;
  myVoteOptionId: string | null;
  onStartPoll: (question: string, options: string[]) => void;
  onAnswerPoll: (optionId: string) => void;
  onEndPoll: () => void;
}

export function PollPanel({
  open,
  onClose,
  isHost,
  poll,
  myVoteOptionId,
  onStartPoll,
  onAnswerPoll,
  onEndPoll,
}: PollPanelProps) {
  const [question, setQuestion] = useState('');
  const [optionInputs, setOptionInputs] = useState(['', '', '', '']);

  const totalVotes = useMemo(() => poll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0, [poll]);

  const handleCreatePoll = () => {
    const cleanQuestion = question.trim();
    const cleanOptions = optionInputs.map((o) => o.trim()).filter(Boolean);
    if (cleanQuestion.length < 3 || cleanOptions.length < 2) return;
    onStartPoll(cleanQuestion, cleanOptions);
    setQuestion('');
    setOptionInputs(['', '', '', '']);
  };

  return (
    <div
      className={clsx(
        'fixed top-0 right-0 bottom-0 w-80 bg-surface-900 border-l border-white/10 flex flex-col z-30 shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-300" />
          <h2 className="text-white font-semibold">Poll / Q&A</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isHost && !poll && (
          <div className="space-y-3">
            <label className="block text-white/70 text-xs font-medium">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              rows={3}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
            />

            <label className="block text-white/70 text-xs font-medium">Options</label>
            <div className="space-y-2">
              {optionInputs.map((value, idx) => (
                <input
                  key={idx}
                  value={value}
                  onChange={(e) => {
                    const next = [...optionInputs];
                    next[idx] = e.target.value;
                    setOptionInputs(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="w-full bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500/60"
                />
              ))}
            </div>

            <button
              onClick={handleCreatePoll}
              disabled={question.trim().length < 3 || optionInputs.filter((o) => o.trim()).length < 2}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Poll
            </button>
          </div>
        )}

        {!poll && !isHost && (
          <p className="text-white/50 text-sm">No active poll right now. Wait for the host to start one.</p>
        )}

        {poll && (
          <div className="space-y-3">
            <p className="text-white text-sm font-medium">{poll.question}</p>
            <p className="text-white/40 text-xs">{totalVotes} vote{totalVotes === 1 ? '' : 's'}</p>
            <div className="space-y-2">
              {poll.options.map((option) => {
                const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                const isMine = myVoteOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => onAnswerPoll(option.id)}
                    className={clsx(
                      'w-full text-left rounded-xl border px-3 py-2 relative overflow-hidden',
                      isMine ? 'border-brand-500 bg-brand-600/10 text-white' : 'border-white/10 bg-surface-800 text-white/80'
                    )}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-brand-500/20"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-sm">{option.text}</span>
                      <span className="text-xs text-white/60">{option.votes} ({percentage}%)</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {isHost && (
              <button
                onClick={onEndPoll}
                className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 text-sm font-medium border border-rose-500/30"
              >
                End Poll
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
