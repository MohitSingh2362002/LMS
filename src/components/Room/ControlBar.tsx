import React, { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff,
  MessageSquare, Users, Settings, PhoneOff, PenTool, Circle, StopCircle, BarChart3, FileText,
  LogOut, OctagonAlert, Pause, Play,
} from 'lucide-react';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';

interface ControlBarProps {
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleWhiteboard: () => void;
  onOpenSettings: () => void;
  onTogglePolls: () => void;
  onToggleDocs: () => void;
  onLeave: () => void;
  /** Host only: end session for all participants (LiveKit + signaling). */
  onEndCallForAll?: () => void;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isWhiteboardOpen: boolean;
  isHost: boolean;
  isRecording: boolean;
  /** Host: capture is paused (participants may use global state instead). */
  recordingPaused?: boolean;
  isPollPanelOpen: boolean;
  isDocPanelOpen: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording?: () => void;
  onResumeRecording?: () => void;
}

interface ControlButtonProps {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
  disabled?: boolean;
  activeColor?: string;
}

function ControlButton({ icon, activeIcon, label, onClick, active, danger, badge, disabled, activeColor }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 group select-none disabled:opacity-40 disabled:cursor-not-allowed',
        danger
          ? 'bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white'
          : active
          ? activeColor
            ? ''
            : 'bg-brand-600/30 text-brand-300 hover:bg-brand-600/50'
          : 'hover:bg-white/10 text-white/60 hover:text-white'
      )}
      style={active && activeColor ? {
        backgroundColor: `${activeColor}30`,
        color: activeColor,
      } : undefined}
    >
      <span className="relative">
        {active && activeIcon ? activeIcon : icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium hidden sm:block">{label}</span>
    </button>
  );
}

export function ControlBar({
  onToggleChat,
  onToggleParticipants,
  onToggleWhiteboard,
  onOpenSettings,
  onTogglePolls,
  onToggleDocs,
  onLeave,
  onEndCallForAll,
  isChatOpen,
  isParticipantsOpen,
  isWhiteboardOpen,
  isHost,
  isRecording,
  recordingPaused = false,
  isPollPanelOpen,
  isDocPanelOpen,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
}: ControlBarProps) {
  const { state, toggleMic, toggleCamera, toggleScreenShare } = useSession();
  const { isMicEnabled, isCameraEnabled, isScreenSharing, unreadCount } = state;
  const [leaving, setLeaving] = useState(false);
  const [hostLeaveOpen, setHostLeaveOpen] = useState(false);
  const hostLeaveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostLeaveOpen) return;
    const onDown = (e: MouseEvent) => {
      if (hostLeaveRef.current && !hostLeaveRef.current.contains(e.target as Node)) {
        setHostLeaveOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [hostLeaveOpen]);

  const handleLeaveButtonClick = () => {
    if (isHost) {
      setHostLeaveOpen((o) => !o);
      return;
    }
    if (leaving) {
      onLeave();
    } else {
      setLeaving(true);
      setTimeout(() => setLeaving(false), 3000);
    }
  };

  const handleHostLeaveRoom = () => {
    setHostLeaveOpen(false);
    onLeave();
  };

  const handleHostEndCall = () => {
    setHostLeaveOpen(false);
    onEndCallForAll?.();
  };

  return (
    <div className="flex-shrink-0 bg-surface-900/90 backdrop-blur-md border-t border-white/8 px-4 py-3">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <ControlButton
          icon={<Mic size={20} />}
          activeIcon={<MicOff size={20} />}
          label={isMicEnabled ? 'Mute' : 'Unmute'}
          onClick={toggleMic}
          active={!isMicEnabled}
        />
        <ControlButton
          icon={<Video size={20} />}
          activeIcon={<VideoOff size={20} />}
          label={isCameraEnabled ? 'Stop Video' : 'Start Video'}
          onClick={toggleCamera}
          active={!isCameraEnabled}
        />
        {isHost && (
          <ControlButton
            icon={<MonitorUp size={20} />}
            activeIcon={<MonitorOff size={20} />}
            label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
            onClick={toggleScreenShare}
            active={isScreenSharing}
          />
        )}

        {/* Whiteboard button — only HOST sees the toggle */}
        {isHost && (
          <ControlButton
            icon={<PenTool size={20} />}
            label="Whiteboard"
            onClick={onToggleWhiteboard}
            active={isWhiteboardOpen}
          />
        )}

        {/* Host-only recording controls */}
        {isHost && !isRecording && (
          <ControlButton
            icon={<Circle size={20} />}
            label="Record"
            onClick={onStartRecording}
            activeColor="#ef4444"
          />
        )}
        {isHost && isRecording && !recordingPaused && (
          <>
            <ControlButton
              icon={<Pause size={20} />}
              label="Pause"
              onClick={() => onPauseRecording?.()}
              disabled={!onPauseRecording}
            />
            <ControlButton
              icon={<StopCircle size={20} />}
              label="Stop Rec"
              onClick={onStopRecording}
              active
              activeColor="#ef4444"
            />
          </>
        )}
        {isHost && isRecording && recordingPaused && (
          <>
            <ControlButton
              icon={<Play size={20} />}
              label="Resume"
              onClick={() => onResumeRecording?.()}
              disabled={!onResumeRecording}
              activeColor="#22c55e"
            />
            <ControlButton
              icon={<StopCircle size={20} />}
              label="Stop Rec"
              onClick={onStopRecording}
              active
              activeColor="#ef4444"
            />
          </>
        )}

        {/* Participants see REC when host is recording (running or paused) */}
        {!isHost && isRecording && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div
              className="w-2 h-2 rounded-full bg-rose-500"
              style={
                !recordingPaused
                  ? { animation: 'pulse 1.5s ease-in-out infinite' }
                  : undefined
              }
            />
            <span className="text-rose-400 text-xs font-medium">
              {recordingPaused ? 'REC (paused)' : 'REC'}
            </span>
          </div>
        )}

        <div className="w-px h-8 bg-white/10 mx-1" />

        <ControlButton
          icon={<MessageSquare size={20} />}
          label="Chat"
          onClick={onToggleChat}
          active={isChatOpen}
          badge={isChatOpen ? 0 : unreadCount}
        />
        <ControlButton
          icon={<Users size={20} />}
          label="People"
          onClick={onToggleParticipants}
          active={isParticipantsOpen}
        />
        <ControlButton
          icon={<Settings size={20} />}
          label="Settings"
          onClick={onOpenSettings}
        />
        <ControlButton
          icon={<BarChart3 size={20} />}
          label="Polls"
          onClick={onTogglePolls}
          active={isPollPanelOpen}
        />
        <ControlButton
          icon={<FileText size={20} />}
          label="Docs"
          onClick={onToggleDocs}
          active={isDocPanelOpen}
        />

        <div className="w-px h-8 bg-white/10 mx-1" />

        {/* Host badge indicator */}
        {isHost && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-600/20 border border-brand-500/30 rounded-lg mr-1">
            <span className="text-sm">♛</span>
            <span className="text-brand-300 text-[10px] font-semibold hidden sm:block">HOST</span>
          </div>
        )}

        <div className="relative" ref={hostLeaveRef}>
          <button
            type="button"
            onClick={handleLeaveButtonClick}
            className={clsx(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150',
              isHost
                ? hostLeaveOpen
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white'
                : leaving
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white'
            )}
          >
            <PhoneOff size={20} />
            <span className="text-[10px] font-medium hidden sm:block">
              {isHost ? (hostLeaveOpen ? 'Close' : 'Exit') : leaving ? 'Click again' : 'Leave'}
            </span>
          </button>

          {isHost && hostLeaveOpen && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-white/10 bg-surface-900 shadow-xl py-1 z-50"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleHostLeaveRoom}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors rounded-t-lg"
              >
                <LogOut size={18} className="text-white/70 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-sm text-white font-medium">Leave room</span>
                  <span className="block text-[11px] text-white/45 mt-0.5 leading-snug">
                    Others stay in the call; host passes to someone else if needed.
                  </span>
                </span>
              </button>
              <div className="h-px bg-white/8 mx-2" />
              <button
                type="button"
                role="menuitem"
                onClick={handleHostEndCall}
                className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-rose-500/15 transition-colors rounded-b-lg"
              >
                <OctagonAlert size={18} className="text-rose-400 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-sm text-rose-300 font-medium">End call for everyone</span>
                  <span className="block text-[11px] text-white/45 mt-0.5 leading-snug">
                    Ends the session and disconnects all participants.
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
