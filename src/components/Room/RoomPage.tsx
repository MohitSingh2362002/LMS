import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ConnectionState } from 'livekit-client';
import toast from 'react-hot-toast';
import { useLiveKitRoom } from '../../hooks/useLiveKitRoom';
import { useSession } from '../../context/SessionContext';
import { useParticipantGrid } from '../../hooks/useParticipantGrid';
import { useHostControls } from '../../hooks/useHostControls';
import { useSessionRecording } from '../../hooks/useSessionRecording';
import { VideoGrid } from './VideoGrid';
import { ControlBar } from './ControlBar';
import { ChatSidebar } from './ChatSidebar';
import { ParticipantsPanel } from './ParticipantsPanel';
import { SettingsModal } from './SettingsModal';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { EmptyState } from './EmptyState';
import { WhiteboardPanel } from './WhiteboardPanel';
import { ParticipantTile } from './ParticipantTile';
import { PollPanel } from './PollPanel';
import { DocPanel } from './DocPanel';
import { Spinner } from '../shared/Spinner';
import { Button } from '../shared/Button';

/** Prevents duplicate auto-record (e.g. React Strict Mode) until the host leaves the room. */
const autoRecordAttemptedForRoom = new Set<string>();

export function RoomPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { connect, disconnect } = useLiveKitRoom();
  const { state, dispatch } = useSession();
  const { total, allParticipants } = useParticipantGrid();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isPollPanelOpen, setIsPollPanelOpen] = useState(false);
  const [isDocPanelOpen, setIsDocPanelOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const connectedAtRef = useRef<Date | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);

  const token = location.state?.token as string | undefined;
  const displayName = location.state?.displayName as string | undefined;
  const joinAs = (location.state?.joinAs as 'host' | 'participant') || 'participant';
  const userColor = (location.state?.userColor as string) || '#7C3AED';
  const decodedRoom = roomName ? decodeURIComponent(roomName) : '';

  // Session recording (actual MediaRecorder)
  const {
    isRecording: isLocalRecordingSession,
    isPaused: isLocalRecordingPaused,
    startRecording: startLocalRecording,
    stopRecording: stopLocalRecording,
    pauseRecording: pauseLocalRecording,
    resumeRecording: resumeLocalRecording,
  } = useSessionRecording();

  // Force mute handler — ONLY called when host explicitly mutes via socket
  const handleForceMute = useCallback(async () => {
    if (!state.room) return;
    try {
      await state.room.localParticipant.setMicrophoneEnabled(false);
      dispatch({ type: 'SET_MIC_ENABLED', enabled: false });
    } catch (err) {
      console.error('[ForceMute] Error:', err);
    }
    toast('You have been muted by the host', {
      icon: '🔇',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  }, [state.room, dispatch]);

  // Force unmute notification
  const handleForceUnmute = useCallback(() => {
    toast('The host has allowed you to unmute', {
      icon: '🎤',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  }, []);

  const handleForceVideoOff = useCallback(async () => {
    if (!state.room) return;
    try {
      await state.room.localParticipant.setCameraEnabled(false);
      dispatch({ type: 'SET_CAMERA_ENABLED', enabled: false });
    } catch (err) {
      console.error('[ForceVideoOff] Error:', err);
    }
    toast('Host stopped your video', {
      icon: '📷',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  }, [state.room, dispatch]);

  const handleForceRemoved = useCallback(() => {
    disconnect();
    toast('Host removed you from the room', {
      icon: '🚪',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
    navigate('/');
  }, [disconnect, navigate]);

  const handleSessionEnded = useCallback(() => {
    if (isLocalRecordingSession) {
      void stopLocalRecording();
    }
    if (decodedRoom) autoRecordAttemptedForRoom.delete(decodedRoom);
    disconnect();
    toast('This session has ended.', {
      icon: '☎️',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
    navigate('/');
  }, [disconnect, navigate, isLocalRecordingSession, stopLocalRecording, decodedRoom]);

  // Host controls hook
  const {
    openWhiteboardForAll,
    closeWhiteboardForAll,
    muteParticipant,
    unmuteParticipant,
    muteAll,
    stopParticipantVideo,
    removeParticipant,
    notifyRecordingStarted,
    notifyRecordingStopped,
    notifyRecordingPaused,
    notifyRecordingResumed,
    startPoll,
    answerPoll,
    endPoll,
    openSharedDoc,
    closeSharedDoc,
    endSessionForAll,
  } = useHostControls({
    roomId: decodedRoom,
    userName: displayName || 'User',
    userColor,
    joinAs,
    onForceMute: handleForceMute,
    onForceUnmute: handleForceUnmute,
    onForceVideoOff: handleForceVideoOff,
    onForceRemoved: handleForceRemoved,
    onSessionEnded: handleSessionEnded,
    dispatch,
  });

  // Combined recording state (local recording OR remote host recording notification)
  const isRecording = isLocalRecordingSession || state.isRecording;
  const recordingPausedForBar = state.isHost ? isLocalRecordingPaused : state.recordingPaused;

  // Host: auto-start screen capture + announcement when joining as host
  useEffect(() => {
    if (isConnecting || connectError || !decodedRoom) return;
    if (!state.isHost || joinAs !== 'host') return;
    if (autoRecordAttemptedForRoom.has(decodedRoom)) return;
    autoRecordAttemptedForRoom.add(decodedRoom);

    void (async () => {
      const success = await startLocalRecording({ playAnnouncement: true });
      if (success) {
        notifyRecordingStarted();
        toast.success('Recording started. This meeting is recorded.', {
          style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
        });
      } else {
        toast('Recording did not start. Use Record when you are ready.', {
          icon: '⏺️',
          style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
        });
      }
    })();
  }, [
    isConnecting,
    connectError,
    state.isHost,
    joinAs,
    decodedRoom,
    startLocalRecording,
    notifyRecordingStarted,
  ]);

  // Handle start recording (host only) — no repeated announcement
  const handleStartRecording = useCallback(async () => {
    const success = await startLocalRecording();
    if (success) {
      notifyRecordingStarted();
      toast.success('Recording started', {
        style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
      });
    } else {
      toast.error('Failed to start recording. Please allow screen sharing.', {
        style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
      });
    }
  }, [startLocalRecording, notifyRecordingStarted]);

  const handlePauseRecording = useCallback(() => {
    if (!pauseLocalRecording()) return;
    notifyRecordingPaused();
    toast('Recording paused', {
      icon: '⏸️',
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  }, [pauseLocalRecording, notifyRecordingPaused]);

  const handleResumeRecording = useCallback(() => {
    if (!resumeLocalRecording()) return;
    notifyRecordingResumed();
    toast.success('Recording resumed', {
      style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
    });
  }, [resumeLocalRecording, notifyRecordingResumed]);

  // Handle stop recording (host only)
  const handleStopRecording = useCallback(async () => {
    const meta = await stopLocalRecording();
    if (meta) {
      notifyRecordingStopped(meta);
      toast.success(`Recording saved (${(meta.size / 1024 / 1024).toFixed(1)} MB)`, {
        style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
      });
    }
  }, [stopLocalRecording, notifyRecordingStopped]);

  // Sync whiteboard open state from host control (participant side only)
  useEffect(() => {
    if (!state.isHost && state.isWhiteboardOpenByHost) {
      setIsWhiteboardOpen(true);
    } else if (!state.isHost && !state.isWhiteboardOpenByHost) {
      setIsWhiteboardOpen(false);
    }
  }, [state.isHost, state.isWhiteboardOpenByHost]);

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
    if (decodedRoom) autoRecordAttemptedForRoom.delete(decodedRoom);
    if (isLocalRecordingSession) {
      void stopLocalRecording();
    }
    disconnect();
    navigate('/');
  };

  const handleEndCallForAll = useCallback(() => {
    endSessionForAll();
  }, [endSessionForAll]);

  const handleRetry = () => {
    navigate('/');
  };

  // Whiteboard toggle for host
  const handleToggleWhiteboard = () => {
    if (state.isHost) {
      if (isWhiteboardOpen) {
        closeWhiteboardForAll();
        setIsWhiteboardOpen(false);
      } else {
        openWhiteboardForAll();
        setIsWhiteboardOpen(true);
      }
    }
    // Participants can't toggle whiteboard
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
        <ParticipantsPanel
          open={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          isHost={state.isHost}
          hostParticipants={state.hostParticipants}
          hostSocketId={state.hostSocketId}
          onMute={muteParticipant}
          onUnmute={unmuteParticipant}
          onMuteAll={muteAll}
          onStopVideo={stopParticipantVideo}
          onRemoveParticipant={removeParticipant}
        />

        <PollPanel
          open={isPollPanelOpen}
          onClose={() => setIsPollPanelOpen(false)}
          isHost={state.isHost}
          poll={state.activePoll}
          myVoteOptionId={state.myPollVoteOptionId}
          onStartPoll={startPoll}
          onAnswerPoll={answerPoll}
          onEndPoll={endPoll}
        />

        <DocPanel
          open={isDocPanelOpen}
          onClose={() => setIsDocPanelOpen(false)}
          isHost={state.isHost}
          doc={state.sharedDoc}
          onOpenDoc={openSharedDoc}
          onCloseDocForAll={closeSharedDoc}
        />

        {/* Video area — shown when whiteboard is NOT open */}
        {!isWhiteboardOpen && (
          <div className="flex-1 flex flex-col min-w-0">
            {total <= 1 ? (
              <div className="flex-1 flex flex-col">
                {state.localParticipant && (
                  <div className="flex-1 relative">
                    <EmptyState roomName={decodedRoom} />
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
        )}

        {/* Whiteboard — ALWAYS mounted so socket stays connected */}
        <WhiteboardPanel
          open={isWhiteboardOpen}
          onClose={() => {
            if (state.isHost) {
              closeWhiteboardForAll();
            }
            setIsWhiteboardOpen(false);
          }}
          onRequestOpen={() => setIsWhiteboardOpen(true)}
          roomName={decodedRoom}
          userName={displayName || 'User'}
          isHost={state.isHost}
        />

        {/* Video strip on right — stacked tiles when whiteboard is open */}
        {isWhiteboardOpen && allParticipants.length > 0 && (
          <div className="w-52 flex-shrink-0 flex flex-col gap-2 p-2 bg-surface-900/60 border-l border-white/8 overflow-y-auto scrollbar-thin">
            {allParticipants.map((p) => (
              <div
                key={p.sid}
                className="rounded-xl overflow-hidden border border-white/8 flex-shrink-0"
                style={{ aspectRatio: '16/9' }}
              >
                <ParticipantTile
                  participant={p}
                  isLocal={p.sid === state.localParticipant?.sid}
                  className="w-full h-full"
                  hostSocketId={state.hostSocketId}
                  hostParticipants={state.hostParticipants}
                />
              </div>
            ))}
          </div>
        )}

        {/* Chat sidebar */}
        <ChatSidebar open={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>

      {/* Control bar */}
      <ControlBar
        onToggleChat={() => setIsChatOpen((v) => !v)}
        onToggleParticipants={() => setIsParticipantsOpen((v) => !v)}
        onToggleWhiteboard={handleToggleWhiteboard}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTogglePolls={() => setIsPollPanelOpen((v) => !v)}
        onToggleDocs={() => setIsDocPanelOpen((v) => !v)}
        onLeave={handleLeave}
        onEndCallForAll={state.isHost ? handleEndCallForAll : undefined}
        isChatOpen={isChatOpen}
        isParticipantsOpen={isParticipantsOpen}
        isWhiteboardOpen={isWhiteboardOpen}
        isHost={state.isHost}
        isRecording={isRecording}
        recordingPaused={recordingPausedForBar}
        isPollPanelOpen={isPollPanelOpen}
        isDocPanelOpen={isDocPanelOpen}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onPauseRecording={state.isHost ? handlePauseRecording : undefined}
        onResumeRecording={state.isHost ? handleResumeRecording : undefined}
      />

      {/* Settings modal */}
      <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
