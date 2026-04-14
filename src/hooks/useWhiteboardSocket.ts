import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WBShape } from '../types/whiteboard';

const SOCKET_URL = import.meta.env.VITE_WB_SOCKET_URL || 'http://localhost:3001';

export const useWhiteboardSocket = (
  roomId: string,
  userName: string,
  onInitShapes: (shapes: WBShape[]) => void,
  onShapeAdded: (shape: WBShape) => void,
  onShapeUpdated: (id: string, updates: Partial<WBShape>) => void,
  onShapesDeleted: (ids: string[]) => void,
  onCursorMoved: (cursor: any) => void,
  onCursorLeft: (socketId: string) => void,
  onWhiteboardOpened?: (data: { userName: string; socketId: string }) => void,
  onWhiteboardClosed?: (data: { userName: string; socketId: string }) => void,
) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId || !userName) return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', roomId, userName);
    });

    socket.on('init-shapes', onInitShapes);
    socket.on('shape-added', onShapeAdded);
    socket.on('shape-updated', ({ id, updates }: { id: string; updates: Partial<WBShape> }) =>
      onShapeUpdated(id, updates)
    );
    socket.on('shapes-deleted', onShapesDeleted);
    socket.on('cursor-moved', onCursorMoved);
    socket.on('cursor-left', onCursorLeft);

    // Whiteboard visibility events
    if (onWhiteboardOpened) {
      socket.on('whiteboard-opened', onWhiteboardOpened);
    }
    if (onWhiteboardClosed) {
      socket.on('whiteboard-closed', onWhiteboardClosed);
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  const emitAddShape = useCallback((shape: WBShape) => {
    socketRef.current?.emit('add-shape', roomId, shape);
  }, [roomId]);

  const emitUpdateShape = useCallback((id: string, updates: Partial<WBShape>) => {
    socketRef.current?.emit('update-shape', roomId, id, updates);
  }, [roomId]);

  const emitDeleteShapes = useCallback((ids: string[]) => {
    socketRef.current?.emit('delete-shapes', roomId, ids);
  }, [roomId]);

  const emitUndo = useCallback(() => {
    socketRef.current?.emit('undo', roomId);
  }, [roomId]);

  const emitRedo = useCallback(() => {
    socketRef.current?.emit('redo', roomId);
  }, [roomId]);

  const emitClearCanvas = useCallback(() => {
    socketRef.current?.emit('clear-canvas', roomId);
  }, [roomId]);

  const emitCursorMove = useCallback((x: number, y: number, name: string, color: string) => {
    socketRef.current?.emit('cursor-move', roomId, { x, y, name, color });
  }, [roomId]);

  const emitOpenWhiteboard = useCallback(() => {
    socketRef.current?.emit('open-whiteboard', roomId, userName);
  }, [roomId, userName]);

  const emitCloseWhiteboard = useCallback(() => {
    socketRef.current?.emit('close-whiteboard', roomId, userName);
  }, [roomId, userName]);

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
