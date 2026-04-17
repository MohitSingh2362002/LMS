import React, { useRef, useEffect, useState } from 'react';
import { ConnectionState, Track } from 'livekit-client';
import clsx from 'clsx';
import { useSession } from '../../context/SessionContext';
import { useParticipantGrid } from '../../hooks/useParticipantGrid';
import { ParticipantTile, ScreenShareTile } from './ParticipantTile';

function SkeletonTile({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl bg-surface-800 animate-pulse', className)}>
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-700" />
      </div>
    </div>
  );
}

/**
 * Calculate optimal grid columns and rows to fill the container
 * while keeping tiles as close to 16:9 aspect ratio as possible.
 */
function computeGrid(count: number, containerWidth: number, containerHeight: number) {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) {
    // Side-by-side on landscape, stacked on portrait
    if (containerWidth > containerHeight) {
      return { cols: 2, rows: 1 };
    }
    return { cols: 1, rows: 2 };
  }
  
  // For 3+, find the layout that best fills the container
  let bestCols = 1;
  let bestScore = Infinity;
  
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileW = containerWidth / cols;
    const tileH = containerHeight / rows;
    const tileAspect = tileW / tileH;
    // Target 16:9 aspect ratio
    const score = Math.abs(tileAspect - 16 / 9);
    if (score < bestScore) {
      bestScore = score;
      bestCols = cols;
    }
  }
  
  return { cols: bestCols, rows: Math.ceil(count / bestCols) };
}

export function VideoGrid() {
  const { state } = useSession();
  const { allParticipants, pinnedParticipant } = useParticipantGrid();
  const { connectionState, localParticipant, pinnedParticipantSid, hostSocketId, hostParticipants } = state;
  const { pinParticipant } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  const isConnecting = connectionState === ConnectionState.Connecting;
  const isReconnecting = connectionState === ConnectionState.Reconnecting;

  // Track container size for dynamic grid calculation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Find screen share participant
  const screenShareParticipant = allParticipants.find((p) => {
    const pub = p.getTrackPublication(Track.Source.ScreenShare);
    return pub?.isSubscribed !== false && !!pub?.track;
  });

  const handlePin = (sid: string) => {
    pinParticipant(pinnedParticipantSid === sid ? null : sid);
  };

  if (isConnecting) {
    return (
      <div className="flex-1 p-3 grid grid-cols-2 gap-3">
        <SkeletonTile className="min-h-[200px]" />
        <SkeletonTile className="min-h-[200px]" />
      </div>
    );
  }

  // Pinned spotlight view
  if (pinnedParticipant) {
    const others = allParticipants.filter((p) => p.sid !== pinnedParticipant.sid);
    return (
      <div className="flex-1 flex flex-col gap-2 p-3 overflow-hidden relative">
        {isReconnecting && <ReconnectingOverlay />}

        {screenShareParticipant && (
          <ScreenShareTile participant={screenShareParticipant} className="h-48 w-full flex-shrink-0" />
        )}

        {/* Spotlight — takes remaining space */}
        <div className="flex-1 min-h-0">
          <ParticipantTile
            participant={pinnedParticipant}
            isLocal={pinnedParticipant.sid === localParticipant?.sid}
            isPinned
            onPin={() => handlePin(pinnedParticipant.sid)}
            className="w-full h-full"
            hostSocketId={hostSocketId}
            hostParticipants={hostParticipants}
          />
        </div>

        {/* Thumbnail strip */}
        {others.length > 0 && (
          <div className="flex gap-2 overflow-x-auto flex-shrink-0 pb-1">
            {others.map((p) => (
              <ParticipantTile
                key={p.sid}
                participant={p}
                isLocal={p.sid === localParticipant?.sid}
                onPin={() => handlePin(p.sid)}
                className="w-36 h-24 flex-shrink-0"
                hostSocketId={hostSocketId}
                hostParticipants={hostParticipants}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Calculate grid for current participant count
  const participantCount = allParticipants.length + (screenShareParticipant ? 1 : 0);
  const { cols, rows } = computeGrid(participantCount, containerSize.width, containerSize.height);

  return (
    <div
      ref={containerRef}
      className="flex-1 p-3 overflow-hidden relative"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: '8px',
      }}
    >
      {isReconnecting && <ReconnectingOverlay />}

      {screenShareParticipant && (
        <ScreenShareTile
          participant={screenShareParticipant}
          className="w-full h-full"
        />
      )}

      {allParticipants.map((p) => (
        <ParticipantTile
          key={p.sid}
          participant={p}
          isLocal={p.sid === localParticipant?.sid}
          isPinned={false}
          onPin={() => handlePin(p.sid)}
          className="w-full h-full"
          hostSocketId={hostSocketId}
          hostParticipants={hostParticipants}
        />
      ))}
    </div>
  );
}

function ReconnectingOverlay() {
  return (
    <div className="absolute inset-3 z-20 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white font-medium">Reconnecting…</p>
      </div>
    </div>
  );
}
