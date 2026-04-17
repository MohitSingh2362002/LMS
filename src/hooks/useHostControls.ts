import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ParticipantInfo, PollState, SharedDocState } from '../types';

const SOCKET_URL = import.meta.env.VITE_WHITEBOARD_SOCKET_URL || 'http://localhost:3001';

interface UseHostControlsOptions {
  roomId: string;
  userName: string;
  userColor: string;
  joinAs: 'host' | 'participant';
  onForceMute: () => void;
  onForceUnmute: () => void;
  onForceVideoOff: () => void;
  onForceRemoved: () => void;
  dispatch: React.Dispatch<any>;
}

export function useHostControls({
  roomId,
  userName,
  userColor,
  joinAs,
  onForceMute,
  onForceUnmute,
  onForceVideoOff,
  onForceRemoved,
  dispatch,
}: UseHostControlsOptions) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({ onForceMute, onForceUnmute, onForceVideoOff, onForceRemoved });

  useEffect(() => {
    callbacksRef.current = { onForceMute, onForceUnmute, onForceVideoOff, onForceRemoved };
  });

  // Set initial host state from joinAs IMMEDIATELY (don't wait for socket)
  useEffect(() => {
    dispatch({ type: 'SET_IS_HOST', isHost: joinAs === 'host' });
  }, [joinAs, dispatch]);

  // Connect socket and set up listeners
  useEffect(() => {
    if (!roomId || !userName) return;

    console.log('[HostControls] Connecting to:', SOCKET_URL);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[HostControls] Connected to server:', socket.id);
      socket.emit('join-room', roomId, userName, userColor, joinAs);
    });

    socket.on('connect_error', (err) => {
      console.warn('[HostControls] Socket connection error:', err.message);
      // Even if socket fails, keep the joinAs-based host state
    });

    // Init state from server (overrides joinAs if server has different info)
    socket.on('init-state', (data: {
      hostSocketId: string;
      hostName: string;
      participants: ParticipantInfo[];
      isHost: boolean;
      activePoll: PollState | null;
      myPollVoteOptionId: string | null;
      sharedDoc: SharedDocState | null;
    }) => {
      console.log('[HostControls] Init state from server:', data);
      dispatch({ type: 'SET_IS_HOST', isHost: data.isHost });
      dispatch({ type: 'SET_HOST_INFO', hostSocketId: data.hostSocketId, hostName: data.hostName });
      dispatch({ type: 'SET_HOST_PARTICIPANTS', participants: data.participants });
      dispatch({ type: 'SET_ACTIVE_POLL', poll: data.activePoll });
      dispatch({ type: 'SET_MY_POLL_VOTE', optionId: data.myPollVoteOptionId });
      dispatch({ type: 'SET_SHARED_DOC', doc: data.sharedDoc });
    });

    // Host assigned
    socket.on('host-assigned', (data: { hostSocketId: string; hostName: string }) => {
      dispatch({ type: 'SET_HOST_INFO', hostSocketId: data.hostSocketId, hostName: data.hostName });
    });

    // Became host (after original host left)
    socket.on('you-are-host', () => {
      console.log('[HostControls] You are now the host!');
      dispatch({ type: 'SET_IS_HOST', isHost: true });
    });

    // Host changed
    socket.on('host-changed', (data: { hostSocketId: string; hostName: string }) => {
      dispatch({ type: 'SET_HOST_INFO', hostSocketId: data.hostSocketId, hostName: data.hostName });
    });

    // New participant joined
    socket.on('participant-joined', (p: ParticipantInfo) => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) => [...prev, p],
      });
    });

    // Participant left
    socket.on('participant-left', (socketId: string) => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) => prev.filter((p: ParticipantInfo) => p.socketId !== socketId),
      });
    });

    // ── FEATURE 1: Whiteboard forced open/closed ──
    socket.on('whiteboard-opened-by-host', () => {
      dispatch({ type: 'SET_WHITEBOARD_OPEN_BY_HOST', open: true });
    });
    socket.on('whiteboard-closed-by-host', () => {
      dispatch({ type: 'SET_WHITEBOARD_OPEN_BY_HOST', open: false });
    });

    // ── FEATURE 2: Force mute (only triggered by explicit host action) ──
    socket.on('force-muted', () => {
      callbacksRef.current.onForceMute();
    });
    socket.on('force-unmuted', () => {
      callbacksRef.current.onForceUnmute();
    });
    socket.on('participant-muted', (socketId: string) => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) =>
          prev.map((p: ParticipantInfo) => p.socketId === socketId ? { ...p, isMuted: true } : p),
      });
    });
    socket.on('participant-unmuted', (socketId: string) => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) =>
          prev.map((p: ParticipantInfo) => p.socketId === socketId ? { ...p, isMuted: false } : p),
      });
    });
    socket.on('all-muted-by-host', () => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) =>
          prev.map((p: ParticipantInfo) => ({ ...p, isMuted: true })),
      });
      callbacksRef.current.onForceMute();
    });

    // ── FEATURE 2b: Force video off ──
    socket.on('force-video-off', () => {
      callbacksRef.current.onForceVideoOff();
    });
    socket.on('participant-video-stopped', (socketId: string) => {
      dispatch({
        type: 'UPDATE_HOST_PARTICIPANTS',
        updater: (prev: ParticipantInfo[]) =>
          prev.map((p: ParticipantInfo) => p.socketId === socketId ? { ...p, isVideoOff: true } : p),
      });
    });

    // Host removed a participant from room
    socket.on('force-removed', () => {
      callbacksRef.current.onForceRemoved();
    });

    // ── FEATURE 3: Recording notifications ──
    socket.on('host-recording-started', () => {
      dispatch({ type: 'SET_IS_RECORDING', recording: true });
    });
    socket.on('host-recording-stopped', () => {
      dispatch({ type: 'SET_IS_RECORDING', recording: false });
    });

    socket.on('poll-started', (poll: PollState) => {
      dispatch({ type: 'SET_ACTIVE_POLL', poll });
      dispatch({ type: 'SET_MY_POLL_VOTE', optionId: null });
    });

    socket.on('poll-updated', (poll: PollState) => {
      dispatch({ type: 'SET_ACTIVE_POLL', poll });
    });

    socket.on('poll-vote-recorded', (optionId: string) => {
      dispatch({ type: 'SET_MY_POLL_VOTE', optionId });
    });

    socket.on('poll-ended', () => {
      dispatch({ type: 'SET_ACTIVE_POLL', poll: null });
      dispatch({ type: 'SET_MY_POLL_VOTE', optionId: null });
    });

    socket.on('doc-opened', (doc: SharedDocState) => {
      dispatch({ type: 'SET_SHARED_DOC', doc });
    });

    socket.on('doc-closed', () => {
      dispatch({ type: 'SET_SHARED_DOC', doc: null });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, userName, userColor, joinAs, dispatch]);

  // ── Host actions ──

  const openWhiteboardForAll = useCallback(() => {
    socketRef.current?.emit('whiteboard-open', roomId);
    dispatch({ type: 'SET_WHITEBOARD_OPEN_BY_HOST', open: true });
  }, [roomId, dispatch]);

  const closeWhiteboardForAll = useCallback(() => {
    socketRef.current?.emit('whiteboard-close', roomId);
    dispatch({ type: 'SET_WHITEBOARD_OPEN_BY_HOST', open: false });
  }, [roomId, dispatch]);

  const muteParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit('mute-participant', roomId, targetSocketId);
  }, [roomId]);

  const unmuteParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit('unmute-participant', roomId, targetSocketId);
  }, [roomId]);

  const muteAll = useCallback(() => {
    socketRef.current?.emit('mute-all', roomId);
  }, [roomId]);

  const stopParticipantVideo = useCallback((targetSocketId: string) => {
    socketRef.current?.emit('stop-participant-video', roomId, targetSocketId);
  }, [roomId]);

  const removeParticipant = useCallback((targetSocketId: string) => {
    socketRef.current?.emit('remove-participant', roomId, targetSocketId);
  }, [roomId]);

  const notifyRecordingStarted = useCallback(() => {
    socketRef.current?.emit('recording-started', roomId);
    dispatch({ type: 'SET_IS_RECORDING', recording: true });
  }, [roomId, dispatch]);

  const notifyRecordingStopped = useCallback((meta?: {
    fileName: string; duration: number; size: number;
  }) => {
    socketRef.current?.emit('recording-stopped', roomId, meta);
    dispatch({ type: 'SET_IS_RECORDING', recording: false });
  }, [roomId, dispatch]);

  const startPoll = useCallback((question: string, options: string[]) => {
    socketRef.current?.emit('start-poll', roomId, question, options);
  }, [roomId]);

  const answerPoll = useCallback((optionId: string) => {
    socketRef.current?.emit('vote-poll', roomId, optionId);
  }, [roomId]);

  const endPoll = useCallback(() => {
    socketRef.current?.emit('end-poll', roomId);
  }, [roomId]);

  const openSharedDoc = useCallback((url: string, title: string) => {
    socketRef.current?.emit('open-doc', roomId, url, title);
  }, [roomId]);

  const closeSharedDoc = useCallback(() => {
    socketRef.current?.emit('close-doc', roomId);
  }, [roomId]);

  return {
    socket: socketRef,
    openWhiteboardForAll,
    closeWhiteboardForAll,
    muteParticipant,
    unmuteParticipant,
    muteAll,
    stopParticipantVideo,
    removeParticipant,
    notifyRecordingStarted,
    notifyRecordingStopped,
    startPoll,
    answerPoll,
    endPoll,
    openSharedDoc,
    closeSharedDoc,
  };
}
