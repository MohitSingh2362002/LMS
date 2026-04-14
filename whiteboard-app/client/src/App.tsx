import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWhiteboard } from './hooks/useWhiteboard';
import { useSocket } from './hooks/useSocket';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { Toolbar } from './components/Toolbar';
import { ActionBar } from './components/ActionBar';
import { CollaboratorCursor } from './types';
import Konva from 'konva';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#e91e63'];

function getColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    room: params.get('room') || '',
    name: params.get('name') || '',
  };
}

// ── Join Form ────────────────────────────────────────
const JoinForm: React.FC<{ onJoin: (room: string, name: string) => void }> = ({ onJoin }) => {
  const [room, setRoom] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (room.trim() && name.trim()) {
      onJoin(room.trim(), name.trim());
    }
  };

  return (
    <div className="join-overlay">
      <div className="join-card">
        <div className="join-header">
          <div className="join-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#grad)" />
              <path d="M12 14h16M12 20h12M12 26h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1>Collaborative Whiteboard</h1>
          <p>Draw, sketch, and collaborate in real-time with your team</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="join-field">
            <label htmlFor="room-input">Room Name</label>
            <input
              id="room-input"
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. design-sprint"
              autoFocus
            />
          </div>
          <div className="join-field">
            <label htmlFor="name-input">Your Name</label>
            <input
              id="name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice"
            />
          </div>
          <button type="submit" className="join-btn" disabled={!room.trim() || !name.trim()}>
            Join Whiteboard
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────
export default function App() {
  const urlParams = getUrlParams();
  const [joined, setJoined] = useState(!!urlParams.room && !!urlParams.name);
  const [roomId, setRoomId] = useState(urlParams.room);
  const [userName, setUserName] = useState(urlParams.name);
  const [cursors, setCursors] = useState<CollaboratorCursor[]>([]);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const stageRef = useRef<Konva.Stage>(null);

  const wb = useWhiteboard();

  const myColor = getColorFromId(userName || 'anon');

  const handleCursorMoved = useCallback((cursor: CollaboratorCursor) => {
    setCursors((prev) => {
      const filtered = prev.filter((c) => c.socketId !== cursor.socketId);
      return [...filtered, cursor];
    });
  }, []);

  const handleCursorLeft = useCallback((socketId: string) => {
    setCursors((prev) => prev.filter((c) => c.socketId !== socketId));
  }, []);

  const socket = useSocket(
    roomId,
    userName,
    wb.initShapes,
    wb.addShape,
    wb.updateShapeLocal,
    wb.deleteShapesLocal,
    handleCursorMoved,
    handleCursorLeft,
  );

  // Window resize
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!joined) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); socket.emitUndo(); }
      if (meta && e.key === 'z' && e.shiftKey) { e.preventDefault(); socket.emitRedo(); }
      if (meta && e.key === 'y') { e.preventDefault(); socket.emitRedo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (wb.selectedIds.length > 0 && document.activeElement === document.body) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [joined, wb.selectedIds, socket]);

  const handleJoin = (room: string, name: string) => {
    setRoomId(room);
    setUserName(name);
    setJoined(true);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('room', room);
    url.searchParams.set('name', name);
    window.history.replaceState({}, '', url.toString());
  };

  const handleAddShape = useCallback((shape: any) => {
    wb.addShape(shape);
    socket.emitAddShape(shape);
  }, [wb.addShape, socket.emitAddShape]);

  const handleUpdateShape = useCallback((id: string, updates: any) => {
    wb.updateShapeLocal(id, updates);
    socket.emitUpdateShape(id, updates);
  }, [wb.updateShapeLocal, socket.emitUpdateShape]);

  const handleDeleteShapes = useCallback((ids: string[]) => {
    wb.deleteShapesLocal(ids);
    socket.emitDeleteShapes(ids);
  }, [wb.deleteShapesLocal, socket.emitDeleteShapes]);

  const handleDeleteSelected = useCallback(() => {
    if (wb.selectedIds.length === 0) return;
    handleDeleteShapes(wb.selectedIds);
    wb.setSelectedIds([]);
  }, [wb.selectedIds, handleDeleteShapes, wb.setSelectedIds]);

  const handleCursorMove = useCallback((x: number, y: number) => {
    socket.emitCursorMove(x, y, userName, myColor);
  }, [socket.emitCursorMove, userName, myColor]);

  const handleExportPNG = useCallback(() => {
    // Find the stage from the canvas
    const stageElements = document.querySelectorAll('.konvajs-content');
    if (stageElements.length === 0) return;
    const canvas = stageElements[0].querySelector('canvas');
    if (!canvas) return;

    // Use Konva's built-in export — we need room-level stage ref
    // Fallback: capture all canvases
    const allCanvases = stageElements[0].querySelectorAll('canvas');
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = dimensions.width * 2;
    mergedCanvas.height = dimensions.height * 2;
    const ctx = mergedCanvas.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.fillStyle = '#0f0f19';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    allCanvases.forEach((c) => {
      ctx.drawImage(c, 0, 0);
    });

    const uri = mergedCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.href = uri;
    link.click();
  }, [dimensions, roomId]);

  if (!joined) {
    return <JoinForm onJoin={handleJoin} />;
  }

  const toolbarWidth = 64;
  const actionBarHeight = 52;
  const canvasWidth = dimensions.width - toolbarWidth;
  const canvasHeight = dimensions.height - actionBarHeight;

  return (
    <div className="app-layout">
      <ActionBar
        onUndo={socket.emitUndo}
        onRedo={socket.emitRedo}
        onDelete={handleDeleteSelected}
        onClear={socket.emitClearCanvas}
        onExport={handleExportPNG}
        hasSelection={wb.selectedIds.length > 0}
        roomId={roomId}
        userName={userName}
      />
      <div className="app-body">
        <Toolbar
          tool={wb.tool}
          setTool={wb.setTool}
          settings={wb.settings}
          setSettings={wb.setSettings}
        />
        <WhiteboardCanvas
          shapes={wb.shapes}
          activeDrawing={wb.activeDrawing}
          setActiveDrawing={wb.setActiveDrawing}
          selectedIds={wb.selectedIds}
          setSelectedIds={wb.setSelectedIds}
          tool={wb.tool}
          isDrawing={wb.isDrawing}
          createShape={wb.createShape}
          onAddShape={handleAddShape}
          onUpdateShape={handleUpdateShape}
          onDeleteShapes={handleDeleteShapes}
          onCursorMove={handleCursorMove}
          cursors={cursors}
          settings={wb.settings}
          width={canvasWidth}
          height={canvasHeight}
        />
      </div>
    </div>
  );
}
