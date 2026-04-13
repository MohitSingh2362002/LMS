import React from 'react';
import { X, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Participant, Track } from 'livekit-client';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';
import { Avatar } from '../shared/Avatar';

interface ParticipantsPanelProps {
  open: boolean;
  onClose: () => void;
}

function ParticipantRow({ participant, isLocal }: { participant: Participant; isLocal?: boolean }) {
  const name = participant.name || participant.identity;

  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const isMuted = !micPub || micPub.isMuted;

  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const isCamOff = !camPub || camPub.isMuted;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 rounded-xl transition-colors">
      <Avatar name={name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{name}</p>
        <p className="text-white/40 text-xs">{isLocal ? 'You' : 'Guest'}</p>
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
      </div>
    </div>
  );
}

export function ParticipantsPanel({ open, onClose }: ParticipantsPanelProps) {
  const { state } = useSession();
  const { participants, localParticipant } = state;
  const total = (localParticipant ? 1 : 0) + participants.length;

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
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {localParticipant && (
          <ParticipantRow participant={localParticipant} isLocal />
        )}
        {participants.map((p) => (
          <ParticipantRow key={p.sid} participant={p} />
        ))}
        {total === 0 && (
          <p className="text-center text-white/30 text-sm mt-8 px-4">No participants yet.</p>
        )}
      </div>
    </div>
  );
}
