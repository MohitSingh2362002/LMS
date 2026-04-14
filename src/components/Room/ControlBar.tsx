import React, { useState } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff,
  MessageSquare, Users, Settings, LogOut, PhoneOff, PenTool
} from 'lucide-react';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';

interface ControlBarProps {
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onToggleWhiteboard: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isWhiteboardOpen: boolean;
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
}

function ControlButton({ icon, activeIcon, label, onClick, active, danger, badge, disabled }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150 group select-none disabled:opacity-40 disabled:cursor-not-allowed',
        danger
          ? 'bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white'
          : active
          ? 'bg-brand-600/30 text-brand-300 hover:bg-brand-600/50'
          : 'hover:bg-white/10 text-white/60 hover:text-white'
      )}
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
  onLeave,
  isChatOpen,
  isParticipantsOpen,
  isWhiteboardOpen,
}: ControlBarProps) {
  const { state, toggleMic, toggleCamera, toggleScreenShare } = useSession();
  const { isMicEnabled, isCameraEnabled, isScreenSharing, unreadCount } = state;
  const [leaving, setLeaving] = useState(false);

  const handleLeave = () => {
    if (leaving) {
      onLeave();
    } else {
      setLeaving(true);
      setTimeout(() => setLeaving(false), 3000);
    }
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
        <ControlButton
          icon={<MonitorUp size={20} />}
          activeIcon={<MonitorOff size={20} />}
          label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
          onClick={toggleScreenShare}
          active={isScreenSharing}
        />
        <ControlButton
          icon={<PenTool size={20} />}
          label="Whiteboard"
          onClick={onToggleWhiteboard}
          active={isWhiteboardOpen}
        />

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

        <div className="w-px h-8 bg-white/10 mx-1" />

        <button
          onClick={handleLeave}
          className={clsx(
            'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-150',
            leaving
              ? 'bg-rose-500 text-white'
              : 'bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white'
          )}
        >
          <PhoneOff size={20} />
          <span className="text-[10px] font-medium hidden sm:block">
            {leaving ? 'Click again' : 'Leave'}
          </span>
        </button>
      </div>
    </div>
  );
}
