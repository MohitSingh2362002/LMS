import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { ConnectionQuality, ConnectionState, LocalParticipant, RemoteParticipant, Room } from 'livekit-client';
import { ChatMessage, ParticipantInfo, PollState, SessionState, SharedDocState } from '../types';

type SessionAction =
  | { type: 'SET_ROOM'; room: Room; localParticipant: LocalParticipant }
  | { type: 'CLEAR_ROOM' }
  | { type: 'SET_PARTICIPANTS'; participants: RemoteParticipant[] }
  | { type: 'SET_MIC_ENABLED'; enabled: boolean }
  | { type: 'SET_CAMERA_ENABLED'; enabled: boolean }
  | { type: 'SET_SCREEN_SHARING'; sharing: boolean }
  | { type: 'SET_CONNECTION_STATE'; state: ConnectionState }
  | { type: 'SET_CONNECTION_QUALITY'; quality: ConnectionQuality }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'INCREMENT_UNREAD' }
  | { type: 'CLEAR_UNREAD' }
  | { type: 'SET_PINNED'; sid: string | null }
  // Host control actions
  | { type: 'SET_IS_HOST'; isHost: boolean }
  | { type: 'SET_HOST_INFO'; hostSocketId: string; hostName: string }
  | { type: 'SET_HOST_PARTICIPANTS'; participants: ParticipantInfo[] }
  | { type: 'UPDATE_HOST_PARTICIPANTS'; updater: (prev: ParticipantInfo[]) => ParticipantInfo[] }
  | { type: 'SET_WHITEBOARD_OPEN_BY_HOST'; open: boolean }
  | { type: 'SET_IS_RECORDING'; recording: boolean }
  | { type: 'SET_RECORDING_PAUSED'; paused: boolean }
  | { type: 'SET_ACTIVE_POLL'; poll: PollState | null }
  | { type: 'SET_MY_POLL_VOTE'; optionId: string | null }
  | { type: 'SET_SHARED_DOC'; doc: SharedDocState | null };

const initialState: SessionState = {
  room: null,
  localParticipant: null,
  participants: [],
  isMicEnabled: true,
  isCameraEnabled: true,
  isScreenSharing: false,
  connectionState: ConnectionState.Disconnected,
  connectionQuality: ConnectionQuality.Unknown,
  chatMessages: [],
  unreadCount: 0,
  pinnedParticipantSid: null,
  // Host control defaults
  isHost: false,
  hostSocketId: null,
  hostName: '',
  hostParticipants: [],
  isWhiteboardOpenByHost: false,
  isRecording: false,
  recordingPaused: false,
  activePoll: null,
  myPollVoteOptionId: null,
  sharedDoc: null,
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_ROOM':
      return { ...state, room: action.room, localParticipant: action.localParticipant };
    case 'CLEAR_ROOM':
      return { ...initialState };
    case 'SET_PARTICIPANTS':
      return { ...state, participants: action.participants };
    case 'SET_MIC_ENABLED':
      return { ...state, isMicEnabled: action.enabled };
    case 'SET_CAMERA_ENABLED':
      return { ...state, isCameraEnabled: action.enabled };
    case 'SET_SCREEN_SHARING':
      return { ...state, isScreenSharing: action.sharing };
    case 'SET_CONNECTION_STATE':
      return { ...state, connectionState: action.state };
    case 'SET_CONNECTION_QUALITY':
      return { ...state, connectionQuality: action.quality };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatMessages: [...state.chatMessages, action.message] };
    case 'INCREMENT_UNREAD':
      return { ...state, unreadCount: state.unreadCount + 1 };
    case 'CLEAR_UNREAD':
      return { ...state, unreadCount: 0 };
    case 'SET_PINNED':
      return { ...state, pinnedParticipantSid: action.sid };
    // Host control reducers
    case 'SET_IS_HOST':
      return { ...state, isHost: action.isHost };
    case 'SET_HOST_INFO':
      return { ...state, hostSocketId: action.hostSocketId, hostName: action.hostName };
    case 'SET_HOST_PARTICIPANTS':
      return { ...state, hostParticipants: action.participants };
    case 'UPDATE_HOST_PARTICIPANTS':
      return { ...state, hostParticipants: action.updater(state.hostParticipants) };
    case 'SET_WHITEBOARD_OPEN_BY_HOST':
      return { ...state, isWhiteboardOpenByHost: action.open };
    case 'SET_IS_RECORDING':
      return {
        ...state,
        isRecording: action.recording,
        recordingPaused: false,
      };
    case 'SET_RECORDING_PAUSED':
      return { ...state, recordingPaused: action.paused };
    case 'SET_ACTIVE_POLL':
      return { ...state, activePoll: action.poll };
    case 'SET_MY_POLL_VOTE':
      return { ...state, myPollVoteOptionId: action.optionId };
    case 'SET_SHARED_DOC':
      return { ...state, sharedDoc: action.doc };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  sendChatMessage: (text: string) => void;
  pinParticipant: (sid: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  const toggleMic = useCallback(async () => {
    if (!state.room) return;
    const enabled = !state.isMicEnabled;
    await state.room.localParticipant.setMicrophoneEnabled(enabled);
    dispatch({ type: 'SET_MIC_ENABLED', enabled });
  }, [state.room, state.isMicEnabled]);

  const toggleCamera = useCallback(async () => {
    if (!state.room) return;
    const enabled = !state.isCameraEnabled;
    await state.room.localParticipant.setCameraEnabled(enabled);
    dispatch({ type: 'SET_CAMERA_ENABLED', enabled });
  }, [state.room, state.isCameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!state.room) return;
    const sharing = !state.isScreenSharing;
    await state.room.localParticipant.setScreenShareEnabled(sharing);
    dispatch({ type: 'SET_SCREEN_SHARING', sharing });
  }, [state.room, state.isScreenSharing]);

  const sendChatMessage = useCallback((text: string) => {
    if (!state.room || !text.trim()) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      senderName: state.room.localParticipant.name || state.room.localParticipant.identity,
      senderSid: state.room.localParticipant.sid,
      text: text.trim(),
      timestamp: new Date(),
    };
    const payload = new TextEncoder().encode(JSON.stringify(message));
    state.room.localParticipant.publishData(payload, { reliable: true });
    dispatch({ type: 'ADD_CHAT_MESSAGE', message });
  }, [state.room]);

  const pinParticipant = useCallback((sid: string | null) => {
    dispatch({ type: 'SET_PINNED', sid });
  }, []);

  return (
    <SessionContext.Provider value={{ state, dispatch, toggleMic, toggleCamera, toggleScreenShare, sendChatMessage, pinParticipant }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
