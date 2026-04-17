import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, UserX } from 'lucide-react';
import { Participant, Track } from 'livekit-client';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';
import { Avatar } from '../shared/Avatar';
import { ParticipantInfo } from '../../types';

interface ParticipantsPanelProps {
  open: boolean;
  onClose: () => void;
  isHost: boolean;
  hostParticipants: ParticipantInfo[];
  hostSocketId: string | null;
  onMute: (socketId: string) => void;
  onUnmute: (socketId: string) => void;
  onMuteAll: () => void;
  onStopVideo: (socketId: string) => void;
  onRemoveParticipant: (socketId: string) => void;
}

function ParticipantRow({
  participant,
  isLocal,
  isHost,
  isHostUser,
  hostParticipant,
  onMute,
  onUnmute,
  onStopVideo,
  onRemoveParticipant,
}: {
  participant: Participant;
  isLocal?: boolean;
  isHost: boolean;
  isHostUser: boolean;
  hostParticipant?: ParticipantInfo;
  onMute: (socketId: string) => void;
  onUnmute: (socketId: string) => void;
  onStopVideo: (socketId: string) => void;
  onRemoveParticipant: (socketId: string) => void;
}) {
  const name = participant.name || participant.identity;

  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const isMuted = !micPub || micPub.isMuted;

  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const isCamOff = !camPub || camPub.isMuted;

  const isMutedByHost = hostParticipant?.isMuted || false;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 rounded-xl transition-colors group">
      <Avatar name={name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {isLocal && (
            <span className="text-brand-300 text-[10px] font-medium">(You)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isHostUser && (
            <span className="text-[10px] px-1.5 py-0.5 bg-brand-600/40 text-brand-300 rounded-full font-medium flex items-center gap-1">
              ♛ Host
            </span>
          )}
          {isMutedByHost && !isHostUser && (
            <span className="text-[10px] px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-full font-medium">
              Muted by host
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {isMuted ? (
          <MicOff size={13} className="text-rose-400" />
        ) : (
          <Mic size={13} className="text-green-400" />
        )}
        {isCamOff ? (
          <VideoOff size={13} className="text-rose-400" />
        ) : (
          <Video size={13} className="text-green-400" />
        )}

        {/* Host can mute/unmute non-host participants */}
        {isHost && !isLocal && !isHostUser && hostParticipant && (
          <>
            <button
              onClick={() =>
                hostParticipant.isMuted
                  ? onUnmute(hostParticipant.socketId)
                  : onMute(hostParticipant.socketId)
              }
              className={clsx(
                'ml-1 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100',
                hostParticipant.isMuted
                  ? 'bg-green-500/15 hover:bg-green-500/25 text-green-400'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400'
              )}
              title={hostParticipant.isMuted ? 'Unmute' : 'Mute'}
            >
              {hostParticipant.isMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button
              onClick={() => onStopVideo(hostParticipant.socketId)}
              className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400"
              title="Stop video"
            >
              <VideoOff size={13} />
            </button>
            <button
              onClick={() => onRemoveParticipant(hostParticipant.socketId)}
              className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-rose-600/15 hover:bg-rose-600/25 text-rose-400"
              title="Remove participant"
            >
              <UserX size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ParticipantsPanel({
  open,
  onClose,
  isHost,
  hostParticipants,
  hostSocketId,
  onMute,
  onUnmute,
  onMuteAll,
  onStopVideo,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const { state } = useSession();
  const { participants, localParticipant } = state;
  const total = (localParticipant ? 1 : 0) + participants.length;

  // Helper to find matching hostParticipant by name
  const findHostParticipant = (name: string): ParticipantInfo | undefined => {
    return hostParticipants.find(hp => hp.name === name);
  };

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 bottom-0 w-72 bg-surface-900 border-r border-white/10 flex flex-col z-30 shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold">Participants</h2>
          <span className="text-xs bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full font-medium">
            {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mute all button — host only */}
          {isHost && participants.length > 0 && (
            <button
              onClick={onMuteAll}
              className="text-[11px] px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-lg transition-colors font-medium"
            >
              Mute all
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {localParticipant && (
          <ParticipantRow
            participant={localParticipant}
            isLocal
            isHost={isHost}
            isHostUser={state.isHost}
            hostParticipant={findHostParticipant(localParticipant.name || localParticipant.identity)}
            onMute={onMute}
            onUnmute={onUnmute}
            onStopVideo={onStopVideo}
            onRemoveParticipant={onRemoveParticipant}
          />
        )}
        {participants.map((p) => {
          const name = p.name || p.identity;
          const hp = findHostParticipant(name);
          const isThisHostUser = hp?.socketId === hostSocketId;
          return (
            <ParticipantRow
              key={p.sid}
              participant={p}
              isHost={isHost}
              isHostUser={isThisHostUser}
              hostParticipant={hp}
              onMute={onMute}
              onUnmute={onUnmute}
              onStopVideo={onStopVideo}
              onRemoveParticipant={onRemoveParticipant}
            />
          );
        })}
        {total === 0 && (
          <p className="text-center text-white/30 text-sm mt-8 px-4">No participants yet.</p>
        )}
      </div>
    </div>
  );
}
