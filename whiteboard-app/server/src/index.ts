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

interface Participant {
  socketId: string;
  name: string;
  color: string;
  isMuted: boolean;
  isVideoOff: boolean;
  joinedAt: number;
}

interface RoomState {
  shapes: Shape[];
  history: Shape[][];
  future: Shape[][];
  hostSocketId: string | null;
  hostName: string;
  participants: Participant[];
}

// ── Room State (in-memory) ─────────────────────────────
const rooms = new Map<string, RoomState>();

const getRoom = (roomId: string): RoomState => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      shapes: [],
      history: [],
      future: [],
      hostSocketId: null,
      hostName: '',
      participants: [],
    });
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
  let currentName = '';

  console.log(`⚡ Client connected: ${socket.id}`);

  // JOIN ROOM
  socket.on('join-room', (roomId: string, userName: string, color: string, joinAs?: string) => {
    currentRoom = roomId;
    currentName = userName;
    socket.join(roomId);

    const room = getRoom(roomId);

    // Host is assigned only to users explicitly joining as host.
    if (room.hostSocketId === null && joinAs === 'host') {
      room.hostSocketId = socket.id;
      room.hostName = userName;
    }

    // Add to participants list
    room.participants.push({
      socketId: socket.id,
      name: userName,
      color,
      isMuted: false,
      isVideoOff: false,
      joinedAt: Date.now(),
    });

    // Send current state to new joiner
    socket.emit('init-state', {
      shapes: room.shapes,
      hostSocketId: room.hostSocketId,
      hostName: room.hostName,
      participants: room.participants,
      isHost: room.hostSocketId === socket.id,
    });

    // Notify everyone else
    socket.to(roomId).emit('participant-joined', {
      socketId: socket.id,
      name: userName,
      color,
      isMuted: false,
      isVideoOff: false,
      joinedAt: Date.now(),
    });

    // Tell new joiner who the host is
    socket.emit('host-assigned', {
      hostSocketId: room.hostSocketId,
      hostName: room.hostName,
    });

    // Send existing shapes to new joiner
    socket.emit('init-shapes', room.shapes);

    console.log(`👤 ${userName} joined room: ${roomId} (host: ${room.hostSocketId === socket.id})`);
  });

  // ── WHITEBOARD SHAPE EVENTS (existing) ─────────────────

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

  // ── FEATURE 1: WHITEBOARD HOST CONTROL ───────────────────

  socket.on('whiteboard-open', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return; // only host
    socket.to(roomId).emit('whiteboard-opened-by-host');
    console.log(`📋 Host opened whiteboard for everyone in room: ${roomId}`);
  });

  socket.on('whiteboard-close', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return; // only host
    socket.to(roomId).emit('whiteboard-closed-by-host');
    console.log(`📋 Host closed whiteboard for everyone in room: ${roomId}`);
  });

  // ── FEATURE 2: MUTE CONTROL ─────────────────────────────

  socket.on('mute-participant', (roomId: string, targetSocketId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return; // only host

    const participant = room.participants.find(p => p.socketId === targetSocketId);
    if (participant) {
      participant.isMuted = true;
    }

    // Tell the target participant to mute themselves
    io.to(targetSocketId).emit('force-muted');

    // Update everyone's participant list
    io.to(roomId).emit('participant-muted', targetSocketId);
    console.log(`🔇 Host muted participant ${targetSocketId} in room: ${roomId}`);
  });

  socket.on('unmute-participant', (roomId: string, targetSocketId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;

    const participant = room.participants.find(p => p.socketId === targetSocketId);
    if (participant) participant.isMuted = false;

    io.to(targetSocketId).emit('force-unmuted');
    io.to(roomId).emit('participant-unmuted', targetSocketId);
    console.log(`🎤 Host unmuted participant ${targetSocketId} in room: ${roomId}`);
  });

  socket.on('mute-all', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;

    room.participants.forEach(p => {
      if (p.socketId !== socket.id) {
        p.isMuted = true;
        io.to(p.socketId).emit('force-muted');
      }
    });

    io.to(roomId).emit('all-muted-by-host');
    console.log(`🔇 Host muted all participants in room: ${roomId}`);
  });

  socket.on('stop-participant-video', (roomId: string, targetSocketId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;

    const participant = room.participants.find(p => p.socketId === targetSocketId);
    if (!participant) return;

    participant.isVideoOff = true;
    io.to(targetSocketId).emit('force-video-off');
    io.to(roomId).emit('participant-video-stopped', targetSocketId);
    console.log(`📷 Host stopped participant video ${targetSocketId} in room: ${roomId}`);
  });

  socket.on('remove-participant', (roomId: string, targetSocketId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;
    if (targetSocketId === room.hostSocketId) return;

    io.to(targetSocketId).emit('force-removed');
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    targetSocket?.disconnect(true);
    console.log(`🚪 Host removed participant ${targetSocketId} from room: ${roomId}`);
  });

  // ── FEATURE 3: RECORDING CONTROL ────────────────────────

  socket.on('recording-started', (roomId: string) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;
    socket.to(roomId).emit('host-recording-started');
    console.log(`🔴 Host started recording in room: ${roomId}`);
  });

  socket.on('recording-stopped', (roomId: string, meta: {
    fileName: string; duration: number; size: number;
  }) => {
    const room = getRoom(roomId);
    if (room.hostSocketId !== socket.id) return;
    socket.to(roomId).emit('host-recording-stopped', meta);
    console.log(`⏹ Host stopped recording in room: ${roomId}`);
  });

  // ── DISCONNECT ──────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`💤 Client disconnected: ${socket.id}`);
    if (!currentRoom) return;

    const room = getRoom(currentRoom);

    // Remove from participants
    room.participants = room.participants.filter(p => p.socketId !== socket.id);

    // If host left, assign to next participant
    if (room.hostSocketId === socket.id) {
      const next = room.participants[0];
      if (next) {
        room.hostSocketId = next.socketId;
        room.hostName = next.name;
        io.to(currentRoom).emit('host-changed', {
          hostSocketId: next.socketId,
          hostName: next.name,
        });
        // Notify new host
        io.to(next.socketId).emit('you-are-host');
        console.log(`👑 Host transferred to ${next.name} in room: ${currentRoom}`);
      } else {
        room.hostSocketId = null;
        room.hostName = '';
      }
    }

    socket.to(currentRoom).emit('participant-left', socket.id);
    socket.to(currentRoom).emit('cursor-left', socket.id);
  });
});

// ── Start Server ───────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`\n🎨 Whiteboard server running on http://localhost:${PORT}\n`);
});
