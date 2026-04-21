import { ConnectionQuality, ConnectionState, LocalParticipant, RemoteParticipant, Room } from 'livekit-client';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderSid: string;
  text: string;
  timestamp: Date;
}

export interface ParticipantInfo {
  socketId: string;
  name: string;
  color: string;
  isMuted: boolean;
  isVideoOff: boolean;
  joinedAt: number;
}

export interface WaitingParticipant {
  socketId: string;
  name: string;
  color: string;
  requestedAt: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollState {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  createdBy: string;
}

export interface SharedDocState {
  url: string;
  title: string;
  openedBy: string;
}

export interface SessionState {
  room: Room | null;
  localParticipant: LocalParticipant | null;
  participants: RemoteParticipant[];
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  connectionState: ConnectionState;
  connectionQuality: ConnectionQuality;
  chatMessages: ChatMessage[];
  unreadCount: number;
  pinnedParticipantSid: string | null;
  // Host control fields
  isHost: boolean;
  hostSocketId: string | null;
  hostName: string;
  hostParticipants: ParticipantInfo[];
  isWhiteboardOpenByHost: boolean;
  isRecording: boolean;
  /** True when host paused capture (participants still see session as recording). */
  recordingPaused: boolean;
  activePoll: PollState | null;
  myPollVoteOptionId: string | null;
  sharedDoc: SharedDocState | null;
  // Waiting room fields
  waitingParticipants: WaitingParticipant[];
  /** Participant-side: tracks approval status */
  approvalStatus: 'none' | 'waiting' | 'approved' | 'rejected';
}

export interface TokenResponse {
  token: string;
  [key: string]: unknown;
}

export interface JoinFormData {
  displayName: string;
  roomName: string;
}

export type VideoQuality = 'auto' | 'high' | 'medium' | 'low';

export interface DeviceSettings {
  cameraDeviceId: string;
  micDeviceId: string;
  speakerDeviceId: string;
  backgroundBlur: boolean;
  noiseSuppression: boolean;
  videoQuality: VideoQuality;
}
