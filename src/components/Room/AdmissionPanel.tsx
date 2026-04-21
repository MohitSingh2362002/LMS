import React, { useEffect, useRef } from 'react';
import { X, Check, XCircle, UserPlus, Clock } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../shared/Avatar';
import { WaitingParticipant } from '../../types';

interface AdmissionPanelProps {
  open: boolean;
  onClose: () => void;
  waitingParticipants: WaitingParticipant[];
  onApprove: (socketId: string) => void;
  onReject: (socketId: string) => void;
  onApproveAll: () => void;
}

function formatWaitTime(requestedAt: number): string {
  const seconds = Math.floor((Date.now() - requestedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function WaitingRow({
  participant,
  onApprove,
  onReject,
}: {
  participant: WaitingParticipant;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [waitTime, setWaitTime] = React.useState(() =>
    formatWaitTime(participant.requestedAt)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(formatWaitTime(participant.requestedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [participant.requestedAt]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors group">
      <Avatar name={participant.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{participant.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock size={10} className="text-white/30" />
          <span className="text-white/30 text-[10px]">Waiting {waitTime}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onApprove}
          className="p-1.5 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-400 transition-all"
          title="Admit"
        >
          <Check size={14} />
        </button>
        <button
          onClick={onReject}
          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 transition-all"
          title="Reject"
        >
          <XCircle size={14} />
        </button>
      </div>
    </div>
  );
}

export function AdmissionPanel({
  open,
  onClose,
  waitingParticipants,
  onApprove,
  onReject,
  onApproveAll,
}: AdmissionPanelProps) {
  const prevCountRef = useRef(waitingParticipants.length);

  // Play notification sound when a new participant joins the waiting room
  useEffect(() => {
    if (waitingParticipants.length > prevCountRef.current) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch {}
    }
    prevCountRef.current = waitingParticipants.length;
  }, [waitingParticipants.length]);

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 bottom-0 w-80 bg-surface-900 border-r border-white/10 flex flex-col z-30 shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-brand-400" />
          <h2 className="text-white font-semibold">Waiting Room</h2>
          {waitingParticipants.length > 0 && (
            <span className="text-xs bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-medium animate-pulse">
              {waitingParticipants.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Admit All button */}
      {waitingParticipants.length > 1 && (
        <div className="px-4 py-3 border-b border-white/8">
          <button
            onClick={onApproveAll}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/20 text-green-400 text-sm font-medium transition-all"
          >
            <Check size={14} />
            Admit All ({waitingParticipants.length})
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {waitingParticipants.map((p) => (
          <WaitingRow
            key={p.socketId}
            participant={p}
            onApprove={() => onApprove(p.socketId)}
            onReject={() => onReject(p.socketId)}
          />
        ))}
        {waitingParticipants.length === 0 && (
          <div className="text-center mt-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-800/60 border border-white/8 flex items-center justify-center mx-auto mb-4">
              <UserPlus size={22} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm">No one is waiting</p>
            <p className="text-white/20 text-xs mt-1">
              Participants will appear here when they try to join
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
