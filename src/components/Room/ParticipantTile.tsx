import React, { useEffect, useRef, useState } from 'react';
import { Participant, Track, LocalParticipant, ParticipantEvent } from 'livekit-client';
import { MicOff, Pin } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../shared/Avatar';

interface ParticipantTileProps {
  participant: Participant;
  isLocal?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  className?: string;
}

export function ParticipantTile({ participant, isLocal, isPinned, onPin, className }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const name = participant.name || participant.identity;

  // Find camera track
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const isCameraEnabled = cameraPublication?.isSubscribed !== false && cameraPublication?.isMuted !== true && !!cameraPublication?.track;

  // Find mic track
  const micPublication = participant.getTrackPublication(Track.Source.Microphone);
  const isMicMuted = !micPublication || micPublication.isMuted;

  // Track speaking state manually (avoids need for RoomContext)
  useEffect(() => {
    const onSpeakingChanged = (speaking: boolean) => {
      setIsSpeaking(speaking);
    };
    participant.on(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
    return () => {
      participant.off(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
    };
  }, [participant]);

  // Attach camera video track
  useEffect(() => {
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (!pub?.track || !videoRef.current) return;
    const el = pub.track.attach(videoRef.current);
    return () => {
      pub.track?.detach(el);
    };
  }, [participant, isCameraEnabled]);

  // Attach audio track for remote participants (local audio is muted to prevent echo)
  useEffect(() => {
    if (isLocal) return; // Don't play own audio
    const pub = participant.getTrackPublication(Track.Source.Microphone);
    if (!pub?.track) return;
    const audioEl = pub.track.attach();
    audioEl.id = `audio-${participant.sid}`;
    document.body.appendChild(audioEl);
    return () => {
      pub.track?.detach(audioEl);
      audioEl.remove();
    };
  }, [participant, isLocal, isMicMuted]);

  return (
    <div
      className={clsx(
        'relative rounded-xl overflow-hidden bg-surface-800 group cursor-pointer transition-all duration-200',
        isSpeaking && 'ring-2 ring-amber-400 animate-speaking-ring',
        isPinned && 'ring-2 ring-brand-500',
        className
      )}
      onClick={onPin}
    >
      {/* Video */}
      {isCameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!!isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-850 min-h-[120px]">
          <Avatar name={name} size="xl" />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Name label */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-white text-xs font-medium drop-shadow px-1.5 py-0.5 bg-black/40 rounded backdrop-blur-sm">
          {name}
          {isLocal && <span className="ml-1 text-brand-300">(You)</span>}
        </span>
      </div>

      {/* Mic muted indicator */}
      {isMicMuted && (
        <div className="absolute top-2 right-2 p-1 bg-rose-500/90 rounded-full">
          <MicOff size={10} className="text-white" />
        </div>
      )}

      {/* Pin indicator / button */}
      <div className={clsx(
        'absolute top-2 left-2 p-1 bg-black/40 rounded-full backdrop-blur-sm transition-opacity',
        isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}>
        <Pin size={10} className={clsx(isPinned ? 'text-brand-300' : 'text-white/60')} />
      </div>
    </div>
  );
}

// Screen share tile
interface ScreenTileProps {
  participant: Participant;
  className?: string;
}

export function ScreenShareTile({ participant, className }: ScreenTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const name = participant.name || participant.identity;

  useEffect(() => {
    const pub = participant.getTrackPublication(Track.Source.ScreenShare);
    if (!pub?.track || !videoRef.current) return;
    const el = pub.track.attach(videoRef.current);
    return () => { pub.track?.detach(el); };
  }, [participant]);

  return (
    <div className={clsx('relative rounded-xl overflow-hidden bg-surface-800', className)}>
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded">
        {name} — Screen
      </div>
    </div>
  );
}
