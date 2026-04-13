import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  RemoteParticipant,
  DataPacket_Kind,
  ConnectionQuality,
  Track,
} from 'livekit-client';
import toast from 'react-hot-toast';
import { useSession } from '../context/SessionContext';
import { ChatMessage } from '../types';

const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_WS_URL as string;

export function useLiveKitRoom() {
  const { state, dispatch } = useSession();
  const roomRef = useRef<Room | null>(null);
  const connectedAtRef = useRef<Date | null>(null);

  const connect = useCallback(async (token: string) => {
    if (!LIVEKIT_WS_URL) {
      throw new Error('LiveKit WS URL is not configured. Check your .env file.');
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    // Participants helper
    const updateParticipants = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      dispatch({ type: 'SET_PARTICIPANTS', participants: remotes });
    };

    // Event listeners
    room
      .on(RoomEvent.ConnectionStateChanged, (cs: ConnectionState) => {
        dispatch({ type: 'SET_CONNECTION_STATE', state: cs });
        if (cs === ConnectionState.Connected) {
          connectedAtRef.current = new Date();
          dispatch({ type: 'SET_ROOM', room, localParticipant: room.localParticipant });
        }
      })
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        updateParticipants();
        toast.success(`${participant.name || participant.identity} joined`);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        updateParticipants();
        toast(`${participant.name || participant.identity} left`, { icon: '👋' });
      })
      .on(RoomEvent.TrackSubscribed, () => {
        updateParticipants();
      })
      .on(RoomEvent.TrackUnsubscribed, () => {
        updateParticipants();
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, _participant?, _kind?) => {
        try {
          const text = new TextDecoder().decode(payload);
          const msg: ChatMessage = JSON.parse(text);
          msg.timestamp = new Date(msg.timestamp);
          dispatch({ type: 'ADD_CHAT_MESSAGE', message: msg });
          dispatch({ type: 'INCREMENT_UNREAD' });
        } catch (_) {}
      })
      .on(RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video && pub.track.source === Track.Source.ScreenShare) {
          dispatch({ type: 'SET_SCREEN_SHARING', sharing: true });
        }
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.track?.kind === Track.Kind.Video && pub.track.source === Track.Source.ScreenShare) {
          dispatch({ type: 'SET_SCREEN_SHARING', sharing: false });
        }
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant) => {
        if (participant === room.localParticipant) {
          dispatch({ type: 'SET_CONNECTION_QUALITY', quality });
          if (quality === ConnectionQuality.Poor) {
            toast('Poor network quality detected', { icon: '⚠️' });
          }
        }
      })
      .on(RoomEvent.Disconnected, () => {
        dispatch({ type: 'SET_CONNECTION_STATE', state: ConnectionState.Disconnected });
      });

    try {
      console.log('[LiveKit] Connecting to:', LIVEKIT_WS_URL);
      console.log('[LiveKit] Token length:', token.length);
      await room.connect(LIVEKIT_WS_URL, token, { autoSubscribe: true });
      console.log('[LiveKit] Connected successfully!');
      dispatch({ type: 'SET_ROOM', room, localParticipant: room.localParticipant });
      updateParticipants();

      // Enable local camera and microphone so that tracks are published
      try {
        await room.localParticipant.setCameraEnabled(true);
        console.log('[LiveKit] Camera enabled');
      } catch (camErr) {
        console.warn('[LiveKit] Could not enable camera:', camErr);
      }
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        console.log('[LiveKit] Microphone enabled');
      } catch (micErr) {
        console.warn('[LiveKit] Could not enable microphone:', micErr);
      }
    } catch (err) {
      console.error('[LiveKit] Connection failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect: ${message}`);
    }

    return room;
  }, [dispatch]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    dispatch({ type: 'CLEAR_ROOM' });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return { connect, disconnect, room: state.room, connectedAt: connectedAtRef };
}
