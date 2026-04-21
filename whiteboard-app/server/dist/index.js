import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const app = express();
app.use(cors({ origin: '*' }));
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' }
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeBase}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });
app.use('/uploads', express.static(uploadsDir));
// ── Room State (in-memory) ─────────────────────────────
const rooms = new Map();
const getRoom = (roomId) => {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            shapes: [],
            history: [],
            future: [],
            hostSocketId: null,
            hostName: '',
            participants: [],
            activePoll: null,
            sharedDoc: null,
        });
    }
    return rooms.get(roomId);
};
// ── Health check endpoint ──────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: rooms.size });
});
app.get('/rooms/:roomId/host-status', (req, res) => {
    const roomId = req.params.roomId;
    const room = rooms.get(roomId);
    const hasHost = Boolean(room?.hostSocketId);
    res.json({ roomId, hasHost });
});
app.post('/docs/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(req.file.filename)}`;
    res.json({
        url: fileUrl,
        title: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
    });
});
// ── Socket.io Events ───────────────────────────────────
io.on('connection', (socket) => {
    let currentRoom = '';
    let currentName = '';
    console.log(`⚡ Client connected: ${socket.id}`);
    // JOIN ROOM
    socket.on('join-room', (roomId, userName, color, joinAs) => {
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
            activePoll: room.activePoll
                ? {
                    id: room.activePoll.id,
                    question: room.activePoll.question,
                    options: room.activePoll.options,
                    isActive: room.activePoll.isActive,
                    createdBy: room.activePoll.createdBy,
                }
                : null,
            myPollVoteOptionId: room.activePoll?.votesBySocket[socket.id] || null,
            sharedDoc: room.sharedDoc,
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
    socket.on('add-shape', (roomId, shape) => {
        const room = getRoom(roomId);
        room.history.push([...room.shapes]);
        room.future = [];
        room.shapes.push(shape);
        socket.to(roomId).emit('shape-added', shape);
    });
    // UPDATE SHAPE (drag/transform)
    socket.on('update-shape', (roomId, id, updates) => {
        const room = getRoom(roomId);
        const idx = room.shapes.findIndex(s => s.id === id);
        if (idx !== -1) {
            room.shapes[idx] = { ...room.shapes[idx], ...updates };
            socket.to(roomId).emit('shape-updated', { id, updates });
        }
    });
    // DELETE SHAPES
    socket.on('delete-shapes', (roomId, ids) => {
        const room = getRoom(roomId);
        room.history.push([...room.shapes]);
        room.future = [];
        room.shapes = room.shapes.filter(s => !ids.includes(s.id));
        socket.to(roomId).emit('shapes-deleted', ids);
    });
    // UNDO
    socket.on('undo', (roomId) => {
        const room = getRoom(roomId);
        if (room.history.length === 0)
            return;
        room.future.push([...room.shapes]);
        room.shapes = room.history.pop();
        io.to(roomId).emit('init-shapes', room.shapes);
    });
    // REDO
    socket.on('redo', (roomId) => {
        const room = getRoom(roomId);
        if (room.future.length === 0)
            return;
        room.history.push([...room.shapes]);
        room.shapes = room.future.pop();
        io.to(roomId).emit('init-shapes', room.shapes);
    });
    // CLEAR CANVAS
    socket.on('clear-canvas', (roomId) => {
        const room = getRoom(roomId);
        room.history.push([...room.shapes]);
        room.future = [];
        room.shapes = [];
        io.to(roomId).emit('init-shapes', []);
    });
    // WHITEBOARD VISIBILITY (broadcast to others)
    socket.on('open-whiteboard', (roomId, userName) => {
        socket.to(roomId).emit('whiteboard-opened', { userName, socketId: socket.id });
        console.log(`📋 ${userName} opened whiteboard in room: ${roomId}`);
    });
    socket.on('close-whiteboard', (roomId, userName) => {
        socket.to(roomId).emit('whiteboard-closed', { userName, socketId: socket.id });
    });
    // CURSOR MOVEMENT (broadcast to others, not stored)
    socket.on('cursor-move', (roomId, cursor) => {
        socket.to(roomId).emit('cursor-moved', {
            socketId: socket.id, ...cursor
        });
    });
    // ── FEATURE 1: WHITEBOARD HOST CONTROL ───────────────────
    socket.on('whiteboard-open', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return; // only host
        socket.to(roomId).emit('whiteboard-opened-by-host');
        console.log(`📋 Host opened whiteboard for everyone in room: ${roomId}`);
    });
    socket.on('whiteboard-close', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return; // only host
        socket.to(roomId).emit('whiteboard-closed-by-host');
        console.log(`📋 Host closed whiteboard for everyone in room: ${roomId}`);
    });
    // ── FEATURE 2: MUTE CONTROL ─────────────────────────────
    socket.on('mute-participant', (roomId, targetSocketId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return; // only host
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
    socket.on('unmute-participant', (roomId, targetSocketId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        const participant = room.participants.find(p => p.socketId === targetSocketId);
        if (participant)
            participant.isMuted = false;
        io.to(targetSocketId).emit('force-unmuted');
        io.to(roomId).emit('participant-unmuted', targetSocketId);
        console.log(`🎤 Host unmuted participant ${targetSocketId} in room: ${roomId}`);
    });
    socket.on('mute-all', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        room.participants.forEach(p => {
            if (p.socketId !== socket.id) {
                p.isMuted = true;
                io.to(p.socketId).emit('force-muted');
            }
        });
        io.to(roomId).emit('all-muted-by-host');
        console.log(`🔇 Host muted all participants in room: ${roomId}`);
    });
    socket.on('stop-participant-video', (roomId, targetSocketId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        const participant = room.participants.find(p => p.socketId === targetSocketId);
        if (!participant)
            return;
        participant.isVideoOff = true;
        io.to(targetSocketId).emit('force-video-off');
        io.to(roomId).emit('participant-video-stopped', targetSocketId);
        console.log(`📷 Host stopped participant video ${targetSocketId} in room: ${roomId}`);
    });
    socket.on('remove-participant', (roomId, targetSocketId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        if (targetSocketId === room.hostSocketId)
            return;
        io.to(targetSocketId).emit('force-removed');
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        targetSocket?.disconnect(true);
        console.log(`🚪 Host removed participant ${targetSocketId} from room: ${roomId}`);
    });
    // ── FEATURE 3: RECORDING CONTROL ────────────────────────
    socket.on('recording-started', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        socket.to(roomId).emit('host-recording-started');
        console.log(`🔴 Host started recording in room: ${roomId}`);
    });
    socket.on('recording-stopped', (roomId, meta) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        socket.to(roomId).emit('host-recording-stopped', meta);
        console.log(`⏹ Host stopped recording in room: ${roomId}`);
    });
    socket.on('recording-paused', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        socket.to(roomId).emit('host-recording-paused');
        console.log(`⏸ Host paused recording in room: ${roomId}`);
    });
    socket.on('recording-resumed', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        socket.to(roomId).emit('host-recording-resumed');
        console.log(`▶ Host resumed recording in room: ${roomId}`);
    });
    // ── FEATURE 4: POLL / Q&A ───────────────────────────────
    socket.on('start-poll', (roomId, question, options) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        const cleanQuestion = (question || '').trim();
        const cleanOptions = (options || []).map((opt) => opt.trim()).filter(Boolean).slice(0, 6);
        if (!cleanQuestion || cleanOptions.length < 2)
            return;
        const pollId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        room.activePoll = {
            id: pollId,
            question: cleanQuestion,
            options: cleanOptions.map((text, idx) => ({ id: `opt-${idx + 1}`, text, votes: 0 })),
            isActive: true,
            createdBy: room.hostName || 'Host',
            votesBySocket: {},
        };
        io.to(roomId).emit('poll-started', {
            id: room.activePoll.id,
            question: room.activePoll.question,
            options: room.activePoll.options,
            isActive: room.activePoll.isActive,
            createdBy: room.activePoll.createdBy,
        });
    });
    socket.on('vote-poll', (roomId, optionId) => {
        const room = getRoom(roomId);
        if (!room.activePoll || !room.activePoll.isActive)
            return;
        const poll = room.activePoll;
        const nextChoice = poll.options.find((opt) => opt.id === optionId);
        if (!nextChoice)
            return;
        const prevChoiceId = poll.votesBySocket[socket.id];
        if (prevChoiceId === optionId) {
            io.to(socket.id).emit('poll-vote-recorded', optionId);
            return;
        }
        if (prevChoiceId) {
            const prevOption = poll.options.find((opt) => opt.id === prevChoiceId);
            if (prevOption && prevOption.votes > 0) {
                prevOption.votes -= 1;
            }
        }
        poll.votesBySocket[socket.id] = optionId;
        nextChoice.votes += 1;
        io.to(roomId).emit('poll-updated', {
            id: poll.id,
            question: poll.question,
            options: poll.options,
            isActive: poll.isActive,
            createdBy: poll.createdBy,
        });
        io.to(socket.id).emit('poll-vote-recorded', optionId);
    });
    socket.on('end-poll', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        room.activePoll = null;
        io.to(roomId).emit('poll-ended');
    });
    // ── FEATURE 5: SHARED DOC ───────────────────────────────
    socket.on('open-doc', (roomId, url, title) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        const cleanUrl = (url || '').trim();
        if (!cleanUrl)
            return;
        room.sharedDoc = {
            url: cleanUrl,
            title: (title || '').trim() || 'Session Document',
            openedBy: room.hostName || 'Host',
        };
        io.to(roomId).emit('doc-opened', room.sharedDoc);
    });
    socket.on('close-doc', (roomId) => {
        const room = getRoom(roomId);
        if (room.hostSocketId !== socket.id)
            return;
        room.sharedDoc = null;
        io.to(roomId).emit('doc-closed');
    });
    // Host ends the session for everyone (LiveKit + signaling teardown on clients)
    socket.on('host-end-session', async (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.hostSocketId !== socket.id)
            return;
        io.to(roomId).emit('session-ended');
        rooms.delete(roomId);
        const socketsInRoom = await io.in(roomId).fetchSockets();
        for (const s of socketsInRoom) {
            s.disconnect(true);
        }
        console.log(`🛑 Host ended session for room: ${roomId}`);
    });
    // ── DISCONNECT ──────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`💤 Client disconnected: ${socket.id}`);
        if (!currentRoom)
            return;
        const room = rooms.get(currentRoom);
        if (!room)
            return;
        if (room.activePoll) {
            const votedOptionId = room.activePoll.votesBySocket[socket.id];
            if (votedOptionId) {
                const option = room.activePoll.options.find((opt) => opt.id === votedOptionId);
                if (option && option.votes > 0) {
                    option.votes -= 1;
                }
                delete room.activePoll.votesBySocket[socket.id];
                io.to(currentRoom).emit('poll-updated', {
                    id: room.activePoll.id,
                    question: room.activePoll.question,
                    options: room.activePoll.options,
                    isActive: room.activePoll.isActive,
                    createdBy: room.activePoll.createdBy,
                });
            }
        }
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
            }
            else {
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
