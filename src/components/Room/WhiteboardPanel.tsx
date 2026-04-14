import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Transformer, Circle, Group } from 'react-konva';
import Konva from 'konva';
import {
  X, Undo2, Redo2, Trash2, Download,
  Hand, MousePointer2, Pencil, Highlighter, Eraser,
  Minus, ArrowRight, Square, CircleIcon, Type,
} from 'lucide-react';
import clsx from 'clsx';
import { useWhiteboardState } from '../../hooks/useWhiteboardState';
import { useWhiteboardSocket } from '../../hooks/useWhiteboardSocket';
import { useCanvasTransform } from '../../hooks/useCanvasTransform';
import { WBShape, WBCollaboratorCursor } from '../../types/whiteboard';

// ── Tools config (Zoom-style icons) ──────────────────
const TOOLS: { id: any; label: string; icon: React.ReactNode }[] = [
  { id: 'hand',        label: 'Pan',       icon: <Hand size={18} /> },
  { id: 'select',      label: 'Select',    icon: <MousePointer2 size={18} /> },
  { id: 'pen',         label: 'Draw',      icon: <Pencil size={18} /> },
  { id: 'highlighter', label: 'Highlight', icon: <Highlighter size={18} /> },
  { id: 'eraser',      label: 'Eraser',    icon: <Eraser size={18} /> },
  { id: 'line',        label: 'Line',      icon: <Minus size={18} /> },
  { id: 'arrow',       label: 'Arrow',     icon: <ArrowRight size={18} /> },
  { id: 'rect',        label: 'Rectangle', icon: <Square size={18} /> },
  { id: 'ellipse',     label: 'Ellipse',   icon: <CircleIcon size={18} /> },
  { id: 'text',        label: 'Text',      icon: <Type size={18} /> },
];

const STROKE_COLORS = [
  '#ffffff', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
  '#1abc9c', '#34495e',
];

const COLLABORATOR_COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

// ── Collaborator Cursors (Konva) ─────────────────────
const CollaboratorCursors: React.FC<{ cursors: WBCollaboratorCursor[] }> = ({ cursors }) => (
  <>
    {cursors.map((c) => (
      <Group key={c.socketId} x={c.x} y={c.y}>
        <Circle radius={4} fill={c.color} opacity={0.9} />
        <Circle radius={7} stroke={c.color} strokeWidth={1.5} opacity={0.3} />
        <Text text={c.name} fontSize={10} fill={c.color} fontStyle="bold" x={10} y={-6} fontFamily="Inter, sans-serif" />
      </Group>
    ))}
  </>
);

// ── Main WhiteboardPanel (INLINE, not overlay) ───────
interface WhiteboardPanelProps {
  open: boolean;
  onClose: () => void;
  onRequestOpen: () => void;
  roomName: string;
  userName: string;
}

export function WhiteboardPanel({ open, onClose, onRequestOpen, roomName, userName }: WhiteboardPanelProps) {
  const wb = useWhiteboardState();
  const [cursors, setCursors] = useState<WBCollaboratorCursor[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [eraserPos, setEraserPos] = useState({ x: 0, y: 0, visible: false });
  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rubberStart = useRef({ x: 0, y: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const myColor = getColorFromName(userName);
  const wbRoomId = `wb-${roomName}`;

  const {
    getCanvasPoint, getRawPoint, handleWheel,
    startPan, doPan, endPan, isPanning, zoomLevel,
  } = useCanvasTransform();

  // Socket callbacks
  const handleCursorMoved = useCallback((cursor: WBCollaboratorCursor) => {
    setCursors((prev) => [...prev.filter((c) => c.socketId !== cursor.socketId), cursor]);
  }, []);

  const handleCursorLeft = useCallback((socketId: string) => {
    setCursors((prev) => prev.filter((c) => c.socketId !== socketId));
  }, []);

  const handleWhiteboardOpened = useCallback(() => {
    onRequestOpen();
  }, [onRequestOpen]);

  const handleWhiteboardClosed = useCallback(() => {}, []);

  const socket = useWhiteboardSocket(
    wbRoomId, userName,
    wb.initShapes, wb.addShape, wb.updateShapeLocal, wb.deleteShapesLocal,
    handleCursorMoved, handleCursorLeft,
    handleWhiteboardOpened, handleWhiteboardClosed,
  );

  // Emit open/close when panel visibility changes
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) socket.emitOpenWhiteboard();
    else if (!open && prevOpenRef.current) socket.emitCloseWhiteboard();
    prevOpenRef.current = open;
  }, [open, socket.emitOpenWhiteboard, socket.emitCloseWhiteboard]);

  // Canvas resize observer
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  // Prevent default touch on canvas container
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || !open) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('touchend', prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
      el.removeEventListener('touchend', prevent);
    };
  }, [open]);

  // Update transformer
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const nodes = wb.selectedIds
      .map((id) => stageRef.current!.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [wb.selectedIds, wb.shapes]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); socket.emitUndo(); }
      if (meta && e.key === 'z' && e.shiftKey) { e.preventDefault(); socket.emitRedo(); }
      if (meta && e.key === 'y') { e.preventDefault(); socket.emitRedo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && wb.selectedIds.length > 0 && document.activeElement === document.body) {
        e.preventDefault(); handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, wb.selectedIds]);

  const getCursor = () => {
    if (wb.tool === 'hand' || isPanning.current) return 'grab';
    if (wb.tool === 'eraser') return 'none';
    if (wb.tool === 'text') return 'text';
    if (wb.tool === 'select') return 'default';
    return 'crosshair';
  };

  // ── Text editing ──────────────────────────────────
  const openTextarea = useCallback((canvasX: number, canvasY: number, existingShape: WBShape | null) => {
    const stage = stageRef.current!;
    const scale = stage.scaleX();
    const stageBox = stage.container().getBoundingClientRect();
    const screenX = canvasX * scale + stage.x() + stageBox.left;
    const screenY = canvasY * scale + stage.y() + stageBox.top;
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    Object.assign(textarea.style, {
      position: 'fixed', left: `${screenX}px`, top: `${screenY}px`,
      minWidth: '140px', minHeight: '36px',
      background: 'rgba(15,15,25,0.9)', border: '1.5px solid #7C3AED',
      outline: 'none', resize: 'none',
      fontSize: `${wb.settings.fontSize * scale}px`,
      fontFamily: wb.settings.fontFamily, color: wb.settings.strokeColor,
      zIndex: '99999', padding: '6px 8px', borderRadius: '6px',
    });
    textarea.value = existingShape?.text ?? '';
    textarea.focus();
    const commit = () => {
      const val = textarea.value.trim();
      if (val) {
        if (existingShape) handleUpdateShape(existingShape.id, { text: val });
        else {
          const shape = wb.createShape({ type: 'text', x: canvasX, y: canvasY, text: val, strokeColor: wb.settings.strokeColor, fontSize: wb.settings.fontSize, fontFamily: wb.settings.fontFamily, fillColor: 'transparent', strokeWidth: 1, opacity: 1 });
          handleAddShape(shape);
        }
      }
      textarea.remove();
    };
    textarea.addEventListener('blur', commit, { once: true });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { textarea.removeEventListener('blur', commit); textarea.remove(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textarea.blur(); }
    });
  }, [wb.settings, wb.createShape]);

  // ── Shape CRUD ─────────────────────────────────────
  const handleAddShape = useCallback((shape: WBShape) => { wb.addShape(shape); socket.emitAddShape(shape); }, [wb.addShape, socket.emitAddShape]);
  const handleUpdateShape = useCallback((id: string, u: Partial<WBShape>) => { wb.updateShapeLocal(id, u); socket.emitUpdateShape(id, u); }, [wb.updateShapeLocal, socket.emitUpdateShape]);
  const handleDeleteShapes = useCallback((ids: string[]) => { wb.deleteShapesLocal(ids); socket.emitDeleteShapes(ids); }, [wb.deleteShapesLocal, socket.emitDeleteShapes]);
  const handleDeleteSelected = useCallback(() => { if (!wb.selectedIds.length) return; handleDeleteShapes(wb.selectedIds); wb.setSelectedIds([]); }, [wb.selectedIds, handleDeleteShapes]);
  const handleCursorMove = useCallback((x: number, y: number) => { socket.emitCursorMove(x, y, userName, myColor); }, [socket.emitCursorMove, userName, myColor]);
  const handleExportPNG = useCallback(() => { const s = stageRef.current; if (!s) return; const uri = s.toDataURL({ pixelRatio: 2 }); const l = document.createElement('a'); l.download = `whiteboard-${roomName}-${Date.now()}.png`; l.href = uri; l.click(); }, [roomName]);

  // ── Unified pointer handlers (mouse + touch) ──────
  const getPoint = useCallback((e: Konva.KonvaEventObject<any>) => getCanvasPoint(stageRef, e), [getCanvasPoint]);
  const getRaw = useCallback(() => getRawPoint(stageRef), [getRawPoint]);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<any>) => {
    if (e.evt?.button === 1) { startPan(e); return; }
    if (wb.tool === 'hand') { startPan(e); return; }
    const pt = getPoint(e);
    if (wb.tool === 'select') { if (e.target === e.target.getStage()) { wb.setSelectedIds([]); rubberStart.current = pt; setRubberBand({ x: pt.x, y: pt.y, w: 0, h: 0 }); } return; }
    if (wb.tool === 'eraser') { wb.isDrawing.current = true; return; }
    if (wb.tool === 'text') { openTextarea(pt.x, pt.y, null); return; }
    wb.isDrawing.current = true;
    const base = { strokeColor: wb.settings.strokeColor, fillColor: wb.settings.fillColor, strokeWidth: wb.tool === 'highlighter' ? 20 : wb.settings.strokeWidth, opacity: wb.tool === 'highlighter' ? 0.4 : wb.settings.opacity, fontSize: wb.settings.fontSize, fontFamily: wb.settings.fontFamily };
    if (wb.tool === 'pen' || wb.tool === 'highlighter') wb.setActiveDrawing({ type: wb.tool, points: [pt.x, pt.y, pt.x, pt.y], ...base });
    else if (['line', 'arrow', 'rect', 'ellipse'].includes(wb.tool)) wb.setActiveDrawing({ type: wb.tool, startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y, ...base });
  }, [wb.tool, wb.settings, getPoint, startPan, openTextarea]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<any>) => {
    if (e.evt?.button === 1 || (wb.tool === 'hand' && isPanning.current)) { doPan(stageRef, e); return; }
    const pt = getPoint(e); const raw = getRaw(); handleCursorMove(pt.x, pt.y);
    if (wb.tool === 'eraser') {
      setEraserPos({ x: raw.x, y: raw.y, visible: true });
      if (wb.isDrawing.current) { const toD = wb.shapes.filter((s) => { if (s.points?.length) { for (let i = 0; i < s.points.length - 1; i += 2) { if (Math.hypot(s.points[i] - pt.x, s.points[i + 1] - pt.y) < 20) return true; } return false; } const sx = s.x ?? 0, sy = s.y ?? 0, sw = s.width ?? (s.radiusX ?? 0) * 2, sh = s.height ?? (s.radiusY ?? 0) * 2; return pt.x >= sx - 10 && pt.x <= sx + sw + 10 && pt.y >= sy - 10 && pt.y <= sy + sh + 10; }).map((s) => s.id); if (toD.length) handleDeleteShapes(toD); }
      return;
    }
    if (wb.tool === 'select' && rubberBand) { setRubberBand({ x: Math.min(rubberStart.current.x, pt.x), y: Math.min(rubberStart.current.y, pt.y), w: Math.abs(pt.x - rubberStart.current.x), h: Math.abs(pt.y - rubberStart.current.y) }); return; }
    if (!wb.isDrawing.current || !wb.activeDrawing) return;
    if (wb.activeDrawing.type === 'pen' || wb.activeDrawing.type === 'highlighter') { const pts = wb.activeDrawing.points!; const last = pts.slice(-2); if (Math.hypot(pt.x - last[0], pt.y - last[1]) > 3) wb.setActiveDrawing({ ...wb.activeDrawing, points: [...pts, pt.x, pt.y] }); }
    else wb.setActiveDrawing({ ...wb.activeDrawing, currentX: pt.x, currentY: pt.y });
  }, [wb.tool, wb.activeDrawing, wb.shapes, rubberBand, getPoint, getRaw, handleCursorMove, handleDeleteShapes, doPan, isPanning]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<any>) => {
    if (e.evt?.button === 1 || wb.tool === 'hand') { endPan(); return; } endPan();
    if (wb.tool === 'eraser') { wb.isDrawing.current = false; return; }
    if (wb.tool === 'select' && rubberBand) { const inside = wb.shapes.filter((s) => { const sx = s.x ?? (s.points?.[0] ?? 0); const sy = s.y ?? (s.points?.[1] ?? 0); return sx >= rubberBand.x && sx <= rubberBand.x + rubberBand.w && sy >= rubberBand.y && sy <= rubberBand.y + rubberBand.h; }).map((s) => s.id); wb.setSelectedIds(inside); setRubberBand(null); return; }
    if (!wb.isDrawing.current || !wb.activeDrawing) return; wb.isDrawing.current = false;
    let shape: WBShape | null = null; const ad = wb.activeDrawing;
    if (ad.type === 'pen' || ad.type === 'highlighter') { if ((ad.points?.length ?? 0) < 4) { wb.setActiveDrawing(null); return; } shape = wb.createShape({ type: ad.type, points: ad.points, strokeColor: ad.strokeColor, fillColor: 'transparent', strokeWidth: ad.strokeWidth, opacity: ad.opacity }); }
    else if (ad.type === 'line' || ad.type === 'arrow') shape = wb.createShape({ type: ad.type, points: [ad.startX!, ad.startY!, ad.currentX!, ad.currentY!], strokeColor: ad.strokeColor, fillColor: 'transparent', strokeWidth: ad.strokeWidth, opacity: ad.opacity });
    else if (ad.type === 'rect') { const x = Math.min(ad.startX!, ad.currentX!), y = Math.min(ad.startY!, ad.currentY!), w = Math.abs(ad.currentX! - ad.startX!), h = Math.abs(ad.currentY! - ad.startY!); if (w < 2 || h < 2) { wb.setActiveDrawing(null); return; } shape = wb.createShape({ type: 'rect', x, y, width: w, height: h, strokeColor: ad.strokeColor, fillColor: ad.fillColor, strokeWidth: ad.strokeWidth, opacity: ad.opacity }); }
    else if (ad.type === 'ellipse') { const rx = Math.abs(ad.currentX! - ad.startX!) / 2, ry = Math.abs(ad.currentY! - ad.startY!) / 2; if (rx < 2 || ry < 2) { wb.setActiveDrawing(null); return; } shape = wb.createShape({ type: 'ellipse', x: (ad.startX! + ad.currentX!) / 2, y: (ad.startY! + ad.currentY!) / 2, radiusX: rx, radiusY: ry, strokeColor: ad.strokeColor, fillColor: ad.fillColor, strokeWidth: ad.strokeWidth, opacity: ad.opacity }); }
    if (shape) handleAddShape(shape); wb.setActiveDrawing(null);
  }, [wb.tool, wb.activeDrawing, wb.shapes, rubberBand, wb.createShape, handleAddShape, endPan]);

  const handlePointerLeave = useCallback(() => {
    setEraserPos((p) => ({ ...p, visible: false }));
    if (wb.isDrawing.current && wb.activeDrawing) { wb.isDrawing.current = false; if ((wb.activeDrawing.type === 'pen' || wb.activeDrawing.type === 'highlighter') && (wb.activeDrawing.points?.length ?? 0) >= 4) { const shape = wb.createShape({ type: wb.activeDrawing.type, points: wb.activeDrawing.points, strokeColor: wb.activeDrawing.strokeColor, fillColor: 'transparent', strokeWidth: wb.activeDrawing.strokeWidth, opacity: wb.activeDrawing.opacity }); handleAddShape(shape); } wb.setActiveDrawing(null); }
  }, [wb.activeDrawing, wb.createShape, handleAddShape]);

  // ── Shape click handlers ───────────────────────────
  const handleShapeClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (wb.tool !== 'select') return; e.cancelBubble = true;
    wb.setSelectedIds(e.evt.shiftKey ? (wb.selectedIds.includes(id) ? wb.selectedIds.filter((s) => s !== id) : [...wb.selectedIds, id]) : [id]);
  }, [wb.tool, wb.selectedIds]);

  // ── Render helpers ─────────────────────────────────
  const renderActiveDrawing = () => {
    if (!wb.activeDrawing) return null; const ad = wb.activeDrawing;
    const c = { stroke: ad.strokeColor, strokeWidth: ad.strokeWidth, opacity: ad.opacity, listening: false, perfectDrawEnabled: false };
    if (ad.type === 'pen' || ad.type === 'highlighter') return <Line {...c} points={ad.points} tension={0.5} lineCap="round" lineJoin="round" />;
    if (ad.type === 'line') return <Line {...c} points={[ad.startX!, ad.startY!, ad.currentX!, ad.currentY!]} lineCap="round" />;
    if (ad.type === 'arrow') return <Arrow {...c} fill={ad.strokeColor} points={[ad.startX!, ad.startY!, ad.currentX!, ad.currentY!]} pointerLength={10} pointerWidth={8} />;
    if (ad.type === 'rect') return <Rect {...c} x={Math.min(ad.startX!, ad.currentX!)} y={Math.min(ad.startY!, ad.currentY!)} width={Math.abs(ad.currentX! - ad.startX!)} height={Math.abs(ad.currentY! - ad.startY!)} fill={ad.fillColor} />;
    if (ad.type === 'ellipse') return <Ellipse {...c} x={(ad.startX! + ad.currentX!) / 2} y={(ad.startY! + ad.currentY!) / 2} radiusX={Math.abs(ad.currentX! - ad.startX!) / 2} radiusY={Math.abs(ad.currentY! - ad.startY!) / 2} fill={ad.fillColor} />;
    return null;
  };

  const renderShape = (shape: WBShape) => {
    const common = {
      id: shape.id, opacity: shape.opacity, perfectDrawEnabled: false, shadowForStrokeEnabled: false,
      draggable: wb.tool === 'select',
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleShapeClick(shape.id, e),
      onTap: (e: Konva.KonvaEventObject<Event>) => { if (wb.tool !== 'select') return; e.cancelBubble = true; wb.setSelectedIds([shape.id]); },
      onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => { if (shape.type !== 'text') return; e.cancelBubble = true; openTextarea(shape.x!, shape.y!, shape); },
      onDblTap: (e: Konva.KonvaEventObject<Event>) => { if (shape.type !== 'text') return; e.cancelBubble = true; openTextarea(shape.x!, shape.y!, shape); },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleUpdateShape(shape.id, { x: e.target.x(), y: e.target.y() }),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => { const n = e.target; handleUpdateShape(shape.id, { x: n.x(), y: n.y(), width: n.width() * n.scaleX(), height: n.height() * n.scaleY(), rotation: n.rotation() }); n.scaleX(1); n.scaleY(1); },
    };
    switch (shape.type) {
      case 'pen': case 'highlighter': return <Line key={shape.id} {...common} points={shape.points ?? []} stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />;
      case 'line': return <Line key={shape.id} {...common} points={shape.points ?? []} stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} lineCap="round" />;
      case 'arrow': return <Arrow key={shape.id} {...common} points={shape.points ?? []} stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} fill={shape.strokeColor} pointerLength={10} pointerWidth={8} />;
      case 'rect': return <Rect key={shape.id} {...common} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={shape.fillColor} stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} cornerRadius={2} />;
      case 'ellipse': return <Ellipse key={shape.id} {...common} x={shape.x} y={shape.y} radiusX={shape.radiusX!} radiusY={shape.radiusY!} fill={shape.fillColor} stroke={shape.strokeColor} strokeWidth={shape.strokeWidth} />;
      case 'text': return <Text key={shape.id} {...common} x={shape.x} y={shape.y} text={shape.text} fontSize={shape.fontSize} fontFamily={shape.fontFamily} fill={shape.strokeColor} />;
      default: return null;
    }
  };

  const gridDots = useMemo(() => {
    const dots: React.ReactNode[] = [];
    for (let xi = 0; xi < 80; xi++) for (let yi = 0; yi < 60; yi++)
      dots.push(<Circle key={`${xi}-${yi}`} x={xi * 30} y={yi * 30} radius={1} fill="rgba(255,255,255,0.05)" listening={false} perfectDrawEnabled={false} />);
    return dots;
  }, []);

  // ── Render ─────────────────────────────────────────
  // This is an INLINE component (not an overlay). It renders as a flex child
  // inside the room's main area. When `open` is false, it stays mounted
  // but hidden (to keep socket alive).

  return (
    <div className={clsx('flex-1 flex flex-col min-w-0 relative', !open && 'hidden')}>
      {/* Canvas area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden bg-[#0d1117]"
        style={{ cursor: getCursor(), touchAction: 'none' }}
      >
        <Stage
          ref={stageRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerLeave}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onWheel={(e) => handleWheel(stageRef, e)}
        >
          <Layer listening={false}>{gridDots}</Layer>
          <Layer>
            {wb.shapes.sort((a, b) => a.zIndex - b.zIndex).map(renderShape)}
            <Transformer ref={transformerRef} rotateEnabled anchorFill="#7C3AED" anchorStroke="#7C3AED" borderStroke="#7C3AED" anchorSize={8} anchorCornerRadius={2} boundBoxFunc={(o, n) => (n.width < 5 || n.height < 5 ? o : n)} />
          </Layer>
          <Layer listening={false}><CollaboratorCursors cursors={cursors} /></Layer>
          <Layer listening={false}>
            {renderActiveDrawing()}
            {rubberBand && <Rect x={rubberBand.x} y={rubberBand.y} width={rubberBand.w} height={rubberBand.h} fill="rgba(124,58,237,0.08)" stroke="#7C3AED" strokeWidth={1} dash={[4, 3]} listening={false} />}
          </Layer>
        </Stage>

        {/* Eraser cursor */}
        {wb.tool === 'eraser' && eraserPos.visible && (
          <div className="absolute pointer-events-none" style={{ left: eraserPos.x - 16, top: eraserPos.y - 16, width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }} />
        )}

        {/* ═══ Zoom-style FLOATING TOOLBAR (bottom center) ═══ */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div
            className="flex items-center gap-0.5 px-2 py-1.5 rounded-2xl shadow-2xl border border-white/10"
            style={{ background: 'rgba(20,20,35,0.92)', backdropFilter: 'blur(24px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          >
            {/* Tools */}
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => wb.setTool(t.id)}
                className={clsx(
                  'relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 group',
                  wb.tool === t.id
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'text-white/50 hover:text-white hover:bg-white/8'
                )}
                title={t.label}
              >
                {t.icon}
                {/* Tooltip */}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {t.label}
                </span>
              </button>
            ))}

            {/* Divider */}
            <div className="w-px h-7 bg-white/10 mx-1" />

            {/* Active color swatch (click to toggle color picker) */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors group"
              title="Color"
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-white/20 transition-transform hover:scale-110"
                style={{ background: wb.settings.strokeColor }}
              />
              {/* Color picker popup */}
              {showColorPicker && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-2 rounded-xl border border-white/10 shadow-2xl grid grid-cols-5 gap-1.5"
                  style={{ background: 'rgba(20,20,35,0.95)', backdropFilter: 'blur(20px)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STROKE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { wb.setSettings({ ...wb.settings, strokeColor: c }); setShowColorPicker(false); }}
                      className={clsx(
                        'w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
                        wb.settings.strokeColor === c ? 'border-white scale-110' : 'border-transparent'
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  {/* Stroke width slider */}
                  <div className="col-span-5 flex items-center gap-2 mt-1 pt-2 border-t border-white/10">
                    <span className="text-[10px] text-white/40">Size</span>
                    <input
                      type="range" min={1} max={20} value={wb.settings.strokeWidth}
                      onChange={(e) => wb.setSettings({ ...wb.settings, strokeWidth: parseInt(e.target.value) })}
                      className="flex-1 h-1 accent-brand-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-white/40 w-6 text-right">{wb.settings.strokeWidth}px</span>
                  </div>
                </div>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-7 bg-white/10 mx-1" />

            {/* Undo / Redo */}
            <button onClick={socket.emitUndo} className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Undo">
              <Undo2 size={16} />
            </button>
            <button onClick={socket.emitRedo} className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Redo">
              <Redo2 size={16} />
            </button>

            {/* Divider */}
            <div className="w-px h-7 bg-white/10 mx-1" />

            {/* Delete / Export */}
            <button onClick={handleDeleteSelected} disabled={!wb.selectedIds.length} className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30" title="Delete">
              <Trash2 size={16} />
            </button>
            <button onClick={handleExportPNG} className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-brand-400 hover:bg-brand-500/10 transition-colors" title="Export PNG">
              <Download size={16} />
            </button>

            {/* Divider */}
            <div className="w-px h-7 bg-white/10 mx-1" />

            {/* Close whiteboard */}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/8 transition-colors"
              title="Close Whiteboard"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Zoom level badge (bottom-left) */}
        <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md text-white/50 text-[11px] font-semibold px-2.5 py-1 rounded-lg pointer-events-none border border-white/5">
          {zoomLevel}%
        </div>
      </div>
    </div>
  );
}
