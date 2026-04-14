import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Shape } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

export const useSocket = (
  roomId: string,
  userName: string,
  onInitShapes: (shapes: Shape[]) => void,
  onShapeAdded: (shape: Shape) => void,
  onShapeUpdated: (id: string, updates: Partial<Shape>) => void,
  onShapesDeleted: (ids: string[]) => void,
  onCursorMoved: (cursor: any) => void,
  onCursorLeft: (socketId: string) => void,
) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', roomId, userName);
    });

    socket.on('init-shapes', onInitShapes);
    socket.on('shape-added', onShapeAdded);
    socket.on('shape-updated', ({ id, updates }: { id: string; updates: Partial<Shape> }) => onShapeUpdated(id, updates));
    socket.on('shapes-deleted', onShapesDeleted);
    socket.on('cursor-moved', onCursorMoved);
    socket.on('cursor-left', onCursorLeft);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  const emitAddShape = useCallback((shape: Shape) => {
    socketRef.current?.emit('add-shape', roomId, shape);
  }, [roomId]);

  const emitUpdateShape = useCallback((id: string, updates: Partial<Shape>) => {
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

  return {
    emitAddShape,
    emitUpdateShape,
    emitDeleteShapes,
    emitUndo,
    emitRedo,
    emitClearCanvas,
    emitCursorMove,
  };
};
