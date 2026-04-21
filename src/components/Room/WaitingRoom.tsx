import React from 'react';
import { Radio, LogOut, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '../shared/Button';

interface WaitingRoomProps {
  roomName: string;
  displayName: string;
  onLeave: () => void;
}

export function WaitingRoom({ roomName, displayName, onLeave }: WaitingRoomProps) {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-700/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-violet-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="relative">
            <Radio size={28} className="text-brand-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse-dot border-2 border-surface-950" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">LiveSession</span>
        </div>

        {/* Card */}
        <div className="bg-surface-900/80 backdrop-blur-md border border-white/8 rounded-2xl p-8 shadow-2xl shadow-black/40 text-center">
          {/* Animated waiting indicator */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            {/* Outer pulsing ring */}
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            {/* Middle ring */}
            <div className="absolute inset-2 rounded-full bg-brand-500/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.3s' }} />
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center">
                <ShieldCheck size={24} className="text-brand-400" />
              </div>
            </div>
          </div>

          <h2 className="text-white text-lg font-semibold mb-2">Waiting to be admitted</h2>

          <p className="text-white/50 text-sm mb-1">
            The host will let you in soon
          </p>
          <p className="text-white/30 text-xs mb-6">
            Please wait while the host reviews your request
          </p>

          {/* Info badges */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-2.5 bg-surface-800/60 border border-white/6 rounded-xl px-4 py-2.5">
              <Clock size={14} className="text-white/40 flex-shrink-0" />
              <span className="text-white/50 text-sm text-left">Room: <span className="text-white/70 font-medium">{roomName}</span></span>
            </div>
            <div className="flex items-center gap-2.5 bg-surface-800/60 border border-white/6 rounded-xl px-4 py-2.5">
              <span className="text-white/40 text-sm flex-shrink-0">👤</span>
              <span className="text-white/50 text-sm text-left">Joining as: <span className="text-white/70 font-medium">{displayName}</span></span>
            </div>
          </div>

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>

          <Button
            onClick={onLeave}
            className="w-full justify-center py-2.5 bg-surface-800 hover:bg-surface-700 border border-white/10 text-white/70 hover:text-white"
            icon={<LogOut size={14} />}
          >
            Leave Waiting Room
          </Button>
        </div>
      </div>
    </div>
  );
}
