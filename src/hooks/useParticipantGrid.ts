import { useMemo } from 'react';
import { RemoteParticipant } from 'livekit-client';
import { useSession } from '../context/SessionContext';

export type GridLayout = 'single' | 'split' | 'quad' | 'auto';

export function useParticipantGrid() {
  const { state } = useSession();
  const { participants, localParticipant, pinnedParticipantSid } = state;

  const allParticipants = useMemo(() => {
    if (!localParticipant) return [];
    return [localParticipant, ...participants];
  }, [localParticipant, participants]);

  const total = allParticipants.length;

  const layout: GridLayout = useMemo(() => {
    if (total <= 1) return 'single';
    if (total === 2) return 'split';
    if (total <= 4) return 'quad';
    return 'auto';
  }, [total]);

  const pinnedParticipant = useMemo(() => {
    if (!pinnedParticipantSid) return null;
    if (localParticipant?.sid === pinnedParticipantSid) return localParticipant;
    return participants.find((p: RemoteParticipant) => p.sid === pinnedParticipantSid) ?? null;
  }, [pinnedParticipantSid, localParticipant, participants]);

  return { allParticipants, layout, total, pinnedParticipant };
}
