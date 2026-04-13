import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ConnectionState } from 'livekit-client';
import toast from 'react-hot-toast';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';
import { useSession } from '../../context/SessionContext';
import { useParticipantGrid } from '../../hooks/useParticipantGrid';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';
import { ChatSidebar } from './ChatSidebar';
import { ParticipantsPanel } from './ParticipantsPanel';
import { SettingsModal } from './SettingsModal';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { EmptyState } from './EmptyState';
import { Spinner } from '../shared/Spinner';
import { Button } from '../shared/Button';

export function RoomPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { connect, disconnect } = useLiveKitRoom();
  const { state } = useSession();
  const { total } = useParticipantGrid();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const connectedAtRef = useRef<Date | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);

  const token = location.state?.token as string | undefined;
  const displayName = location.state?.displayName as string | undefined;
  const decodedRoom = roomName ? decodeURIComponent(roomName) : '';

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    let mounted = true;
    setIsConnecting(true);
    setConnectError(null);

    connect(token)
      .then(() => {
        if (!mounted) return;
        const now = new Date();
        connectedAtRef.current = now;
        setConnectedAt(now);
        setIsConnecting(false);
      })
      .catch((err: Error) => {
        if (!mounted) return;
        setConnectError(err.message);
        setIsConnecting(false);
      });

    return () => {
      mounted = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Watch for disconnect state
  useEffect(() => {
    if (state.connectionState === ConnectionState.Disconnected && connectedAt) {
      setConnectError('You have been disconnected from the session.');
    }
  }, [state.connectionState, connectedAt]);

  const handleLeave = () => {
    disconnect();
    navigate('/');
  };

  const handleRetry = () => {
    navigate('/');
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-white font-medium">Joining session…</p>
          <p className="text-white/40 text-sm mt-1">{decodedRoom}</p>
        </div>
      </div>
    );
  }

  if (connectError && state.connectionState === ConnectionState.Disconnected) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
        <div className="bg-surface-900 border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-rose-400 text-2xl">!</span>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Connection Failed</h2>
          <p className="text-white/50 text-sm mb-6">{connectError}</p>
          <Button onClick={handleRetry} className="w-full justify-center">
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-950 flex flex-col overflow-hidden">
      {/* Status Bar */}
      <ConnectionStatusBar roomName={decodedRoom} connectedAt={connectedAt} />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Participants panel */}
        <ParticipantsPanel open={isParticipantsOpen} onClose={() => setIsParticipantsOpen(false)} />

        {/* Video area */}
        <div className="flex-1 flex flex-col min-w-0">
          {total <= 1 ? (
            <div className="flex-1 flex flex-col">
              {state.localParticipant && (
                <div className="flex-1 relative">
                  <EmptyState roomName={decodedRoom} />
                  {/* Small local preview */}
                  <div className="absolute bottom-4 right-4 w-40 h-28 rounded-xl overflow-hidden shadow-lg border border-white/10">
                    <VideoGrid />
                  </div>
                </div>
              )}
              {!state.localParticipant && (
                <EmptyState roomName={decodedRoom} />
              )}
            </div>
          ) : (
            <VideoGrid />
          )}
        </div>

        {/* Chat sidebar */}
        <ChatSidebar open={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>

      {/* Control bar */}
      <ControlBar
        onToggleChat={() => setIsChatOpen((v) => !v)}
        onToggleParticipants={() => setIsParticipantsOpen((v) => !v)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLeave={handleLeave}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
      />

      {/* Settings modal */}
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
