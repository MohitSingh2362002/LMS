import { useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';
import { WBShape } from '../types/whiteboard';

/**
 * Whiteboard sync via LiveKit DataChannel.
 *
 * Instead of a separate Socket.IO server, all whiteboard events are sent
 * over LiveKit's reliable data channel.  Both participants are already
 * connected to the same LiveKit room, so this works on Vercel (or any
 * static host) without an extra backend.
 *
 * Message format:
 *   { topic: 'wb', type: '<event-type>', payload: ... }
 */

interface WBMessage {
  topic: 'wb';
  type: string;
  payload?: any;
}

const encode = (msg: WBMessage): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(msg));

const decode = (data: Uint8Array): WBMessage | null => {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data));
    if (parsed?.topic === 'wb') return parsed as WBMessage;
    return null;
  } catch {
    return null;
  }
};

export const useWhiteboardSocket = (
  _roomId: string,
  userName: string,
  onInitShapes: (shapes: WBShape[]) => void,
  onShapeAdded: (shape: WBShape) => void,
  onShapeUpdated: (id: string, updates: Partial<WBShape>) => void,
  onShapesDeleted: (ids: string[]) => void,
  onCursorMoved: (cursor: any) => void,
  onCursorLeft: (socketId: string) => void,
  onWhiteboardOpened?: (data: { userName: string; socketId: string }) => void,
  onWhiteboardClosed?: (data: { userName: string; socketId: string }) => void,
  room?: Room | null,
) => {
  // Keep latest callbacks in refs so the listener never goes stale
  const cbRef = useRef({
    onInitShapes,
    onShapeAdded,
    onShapeUpdated,
    onShapesDeleted,
    onCursorMoved,
    onCursorLeft,
    onWhiteboardOpened,
    onWhiteboardClosed,
  });

  useEffect(() => {
    cbRef.current = {
      onInitShapes,
      onShapeAdded,
      onShapeUpdated,
      onShapesDeleted,
      onCursorMoved,
      onCursorLeft,
      onWhiteboardOpened,
      onWhiteboardClosed,
    };
  });

  // Shapes state kept in-memory for new joiners  (simple; no persistence)
  const shapesRef = useRef<WBShape[]>([]);

  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      const msg = decode(payload);
      if (!msg) return;

      switch (msg.type) {
        case 'init-shapes':
          shapesRef.current = msg.payload as WBShape[];
          cbRef.current.onInitShapes(msg.payload);
          break;
        case 'shape-added':
          shapesRef.current = [...shapesRef.current, msg.payload as WBShape];
          cbRef.current.onShapeAdded(msg.payload);
          break;
        case 'shape-updated': {
          const { id, updates } = msg.payload;
          shapesRef.current = shapesRef.current.map(s => s.id === id ? { ...s, ...updates } : s);
          cbRef.current.onShapeUpdated(id, updates);
          break;
        }
        case 'shapes-deleted': {
          const ids = msg.payload as string[];
          shapesRef.current = shapesRef.current.filter(s => !ids.includes(s.id));
          cbRef.current.onShapesDeleted(ids);
          break;
        }
        case 'cursor-moved':
          cbRef.current.onCursorMoved(msg.payload);
          break;
        case 'cursor-left':
          cbRef.current.onCursorLeft(msg.payload);
          break;
        case 'whiteboard-opened':
          cbRef.current.onWhiteboardOpened?.(msg.payload);
          break;
        case 'whiteboard-closed':
          cbRef.current.onWhiteboardClosed?.(msg.payload);
          break;
        case 'request-shapes':
          // A new participant is asking for current shapes — send them back
          if (shapesRef.current.length > 0) {
            room.localParticipant.publishData(
              encode({ topic: 'wb', type: 'init-shapes', payload: shapesRef.current }),
              { reliable: true }
            );
          }
          break;
      }
    };

    room.on(RoomEvent.DataReceived, handleData);

    // When we join, ask the other participant(s) for existing shapes
    room.localParticipant.publishData(
      encode({ topic: 'wb', type: 'request-shapes' }),
      { reliable: true }
    );

    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  // ── Emitters ─────────────────────────────────────────

  const publish = useCallback(
    (type: string, payload?: any) => {
      if (!room) return;
      room.localParticipant.publishData(
        encode({ topic: 'wb', type, payload }),
        { reliable: type !== 'cursor-moved' }
      );
    },
    [room]
  );

  const emitAddShape = useCallback((shape: WBShape) => {
    shapesRef.current = [...shapesRef.current, shape];
    publish('shape-added', shape);
  }, [publish]);

  const emitUpdateShape = useCallback((id: string, updates: Partial<WBShape>) => {
    shapesRef.current = shapesRef.current.map(s => s.id === id ? { ...s, ...updates } : s);
    publish('shape-updated', { id, updates });
  }, [publish]);

  const emitDeleteShapes = useCallback((ids: string[]) => {
    shapesRef.current = shapesRef.current.filter(s => !ids.includes(s.id));
    publish('shapes-deleted', ids);
  }, [publish]);

  const emitUndo = useCallback(() => {
    publish('undo');
  }, [publish]);

  const emitRedo = useCallback(() => {
    publish('redo');
  }, [publish]);

  const emitClearCanvas = useCallback(() => {
    shapesRef.current = [];
    publish('init-shapes', []);
  }, [publish]);

  const emitCursorMove = useCallback((x: number, y: number, name: string, color: string) => {
    publish('cursor-moved', { socketId: room?.localParticipant?.sid ?? '', x, y, name, color });
  }, [publish, room]);

  const emitOpenWhiteboard = useCallback(() => {
    publish('whiteboard-opened', { userName, socketId: room?.localParticipant?.sid ?? '' });
  }, [publish, userName, room]);

  const emitCloseWhiteboard = useCallback(() => {
    publish('whiteboard-closed', { userName, socketId: room?.localParticipant?.sid ?? '' });
  }, [publish, userName, room]);

  return {
    emitAddShape,
    emitUpdateShape,
    emitDeleteShapes,
    emitUndo,
    emitRedo,
    emitClearCanvas,
    emitCursorMove,
    emitOpenWhiteboard,
    emitCloseWhiteboard,
  };
};
