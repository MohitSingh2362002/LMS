import React, { useState, useEffect } from 'react';
import { ConnectionState, ConnectionQuality } from 'livekit-client';
import { Signal, Users, Clock } from 'lucide-react';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';

function useSessionTimer(connectedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!connectedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function QualityIcon({ quality }: { quality: ConnectionQuality }) {
  const color = {
    [ConnectionQuality.Excellent]: 'text-green-400',
    [ConnectionQuality.Good]: 'text-green-400',
    [ConnectionQuality.Poor]: 'text-yellow-400',
    [ConnectionQuality.Lost]: 'text-rose-400',
    [ConnectionQuality.Unknown]: 'text-white/30',
  }[quality] ?? 'text-white/30';

  return <Signal size={13} className={color} />;
}

const STATE_LABELS: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: 'Connecting…',
  [ConnectionState.Connected]: 'Connected',
  [ConnectionState.Reconnecting]: 'Reconnecting…',
  [ConnectionState.Disconnected]: 'Disconnected',
  [ConnectionState.SignalReconnecting]: 'Reconnecting…',
};

const STATE_COLORS: Record<ConnectionState, string> = {
  [ConnectionState.Connecting]: 'text-yellow-400',
  [ConnectionState.Connected]: 'text-green-400',
  [ConnectionState.Reconnecting]: 'text-yellow-400',
  [ConnectionState.Disconnected]: 'text-rose-400',
  [ConnectionState.SignalReconnecting]: 'text-yellow-400',
};

interface ConnectionStatusBarProps {
  roomName: string;
  connectedAt: Date | null;
}

export function ConnectionStatusBar({ roomName, connectedAt }: ConnectionStatusBarProps) {
  const { state } = useSession();
  const { connectionState, connectionQuality, participants, localParticipant } = state;
  const timer = useSessionTimer(connectedAt);
  const total = (localParticipant ? 1 : 0) + participants.length;

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-surface-950/80 backdrop-blur-sm border-b border-white/8 text-xs">
      <div className="flex items-center gap-3">
        <span className={clsx('font-medium', STATE_COLORS[connectionState] ?? 'text-white/60')}>
          {STATE_LABELS[connectionState] ?? 'Unknown'}
        </span>
        <span className="text-white/30">•</span>
        <span className="text-white/50 font-mono">{roomName}</span>
      </div>

      <div className="flex items-center gap-3 text-white/50">
        <span className="flex items-center gap-1">
          <Users size={11} />
          {total}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <Clock size={11} />
          {timer}
        </span>
        <QualityIcon quality={connectionQuality} />
      </div>
    </div>
  );
}
