import { ConnectionQuality, ConnectionState, LocalParticipant, RemoteParticipant, Room } from 'livekit-client';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderSid: string;
  text: string;
  timestamp: Date;
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
