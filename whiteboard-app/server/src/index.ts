import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// ── Types ──────────────────────────────────────────────
interface Shape {
  id: string;
  type: string;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  zIndex: number;
  rotation?: number;
}

interface Room {
  shapes: Shape[];
  history: Shape[][];
  future: Shape[][];
}

// ── Room State (in-memory) ─────────────────────────────
const rooms = new Map<string, Room>();

const getRoom = (roomId: string): Room => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { shapes: [], history: [], future: [] });
  }
  return rooms.get(roomId)!;
};

// ── Health check endpoint ──────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// ── Socket.io Events ───────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = '';

  console.log(`⚡ Client connected: ${socket.id}`);

  // JOIN ROOM
  socket.on('join-room', (roomId: string, userName: string) => {
    currentRoom = roomId;
    socket.join(roomId);
    const room = getRoom(roomId);
    // Send existing shapes to new joiner
    socket.emit('init-shapes', room.shapes);
    // Notify others
    socket.to(roomId).emit('user-joined', { userName, socketId: socket.id });
    console.log(`👤 ${userName} joined room: ${roomId}`);
  });

  // ADD SHAPE (single shape finalized on mouseUp)
  socket.on('add-shape', (roomId: string, shape: Shape) => {
    const room = getRoom(roomId);
    room.history.push([...room.shapes]);
    room.future = [];
    room.shapes.push(shape);
    socket.to(roomId).emit('shape-added', shape);
  });

  // UPDATE SHAPE (drag/transform)
  socket.on('update-shape', (roomId: string, id: string, updates: Partial<Shape>) => {
    const room = getRoom(roomId);
    const idx = room.shapes.findIndex(s => s.id === id);
    if (idx !== -1) {
      room.shapes[idx] = { ...room.shapes[idx], ...updates };
      socket.to(roomId).emit('shape-updated', { id, updates });
    }
  });

  // DELETE SHAPES
  socket.on('delete-shapes', (roomId: string, ids: string[]) => {
    const room = getRoom(roomId);
    room.history.push([...room.shapes]);
    room.future = [];
    room.shapes = room.shapes.filter(s => !ids.includes(s.id));
    socket.to(roomId).emit('shapes-deleted', ids);
  });

  // UNDO
  socket.on('undo', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.history.length === 0) return;
    room.future.push([...room.shapes]);
    room.shapes = room.history.pop()!;
    io.to(roomId).emit('init-shapes', room.shapes);
  });

  // REDO
  socket.on('redo', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.future.length === 0) return;
    room.history.push([...room.shapes]);
    room.shapes = room.future.pop()!;
    io.to(roomId).emit('init-shapes', room.shapes);
  });

  // CLEAR CANVAS
  socket.on('clear-canvas', (roomId: string) => {
    const room = getRoom(roomId);
    room.history.push([...room.shapes]);
    room.future = [];
    room.shapes = [];
    io.to(roomId).emit('init-shapes', []);
  });

  // WHITEBOARD VISIBILITY (broadcast to others)
  socket.on('open-whiteboard', (roomId: string, userName: string) => {
    socket.to(roomId).emit('whiteboard-opened', { userName, socketId: socket.id });
    console.log(`📋 ${userName} opened whiteboard in room: ${roomId}`);
  });

  socket.on('close-whiteboard', (roomId: string, userName: string) => {
    socket.to(roomId).emit('whiteboard-closed', { userName, socketId: socket.id });
  });

  // CURSOR MOVEMENT (broadcast to others, not stored)
  socket.on('cursor-move', (roomId: string, cursor: {
    x: number; y: number; name: string; color: string;
  }) => {
    socket.to(roomId).emit('cursor-moved', {
      socketId: socket.id, ...cursor
    });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`💤 Client disconnected: ${socket.id}`);
    if (currentRoom) {
      socket.to(currentRoom).emit('cursor-left', socket.id);
    }
  });
});

// ── Start Server ───────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`\n🎨 Whiteboard server running on http://localhost:${PORT}\n`);
});
