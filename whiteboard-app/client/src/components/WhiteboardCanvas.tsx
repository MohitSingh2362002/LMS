import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Transformer, Circle } from 'react-konva';
import Konva from 'konva';
import { Shape, Tool, ActiveDrawing, CollaboratorCursor, DrawingSettings } from '../types';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { CollaboratorCursors } from './CollaboratorCursors';

interface Props {
  shapes: Shape[];
  activeDrawing: ActiveDrawing | null;
  setActiveDrawing: (d: ActiveDrawing | null) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  tool: Tool;
  isDrawing: React.MutableRefObject<boolean>;
  createShape: (p: Partial<Shape>) => Shape;
  onAddShape: (shape: Shape) => void;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  onDeleteShapes: (ids: string[]) => void;
  onCursorMove: (x: number, y: number) => void;
  cursors: CollaboratorCursor[];
  settings: DrawingSettings;
  width: number;
  height: number;
}

export const WhiteboardCanvas: React.FC<Props> = ({
  shapes, activeDrawing, setActiveDrawing,
  selectedIds, setSelectedIds,
  tool, isDrawing, createShape,
  onAddShape, onUpdateShape, onDeleteShapes,
  onCursorMove, cursors, settings, width, height,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [eraserPos, setEraserPos] = useState({ x: 0, y: 0, visible: false });
  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rubberStart = useRef({ x: 0, y: 0 });
  const {
    getCanvasPoint, getRawPoint, handleWheel,
    startPan, doPan, endPan, isPanning, zoomLevel,
  } = useCanvasTransform();

  // Update transformer nodes when selection changes
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const nodes = selectedIds
      .map((id) => stageRef.current!.findOne(`#${id}`))
      .filter(Boolean) as Konva.Node[];
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, shapes]);

  const getCursor = () => {
    if (tool === 'hand' || isPanning.current) return 'grab';
    if (tool === 'eraser') return 'none';
    if (tool === 'text') return 'text';
    if (tool === 'select') return 'default';
    return 'crosshair';
  };

  // ── Text editing overlay ───────────────────────────
  const openTextarea = useCallback((canvasX: number, canvasY: number, existingShape: Shape | null) => {
    const stage = stageRef.current!;
    const scale = stage.scaleX();
    const stageBox = stage.container().getBoundingClientRect();
    const screenX = canvasX * scale + stage.x() + stageBox.left;
    const screenY = canvasY * scale + stage.y() + stageBox.top;

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textareaRef.current = textarea;

    Object.assign(textarea.style, {
      position: 'fixed',
      left: `${screenX}px`,
      top: `${screenY}px`,
      minWidth: '140px',
      minHeight: '36px',
      background: 'rgba(15,15,25,0.85)',
      border: '1.5px solid #7C3AED',
      outline: 'none',
      resize: 'none',
      fontSize: `${settings.fontSize * scale}px`,
      fontFamily: settings.fontFamily,
      color: settings.strokeColor,
      zIndex: '99999',
      padding: '6px 8px',
      borderRadius: '6px',
      backdropFilter: 'blur(8px)',
    });

    textarea.value = existingShape?.text ?? '';
    textarea.focus();

    const commit = () => {
      const val = textarea.value.trim();
      if (val) {
        if (existingShape) {
          onUpdateShape(existingShape.id, { text: val });
        } else {
          const shape = createShape({
            type: 'text',
            x: canvasX,
            y: canvasY,
            text: val,
            strokeColor: settings.strokeColor,
            fontSize: settings.fontSize,
            fontFamily: settings.fontFamily,
            fillColor: 'transparent',
            strokeWidth: 1,
            opacity: 1,
          });
          onAddShape(shape);
        }
      }
      textarea.remove();
      textareaRef.current = null;
    };

    textarea.addEventListener('blur', commit, { once: true });
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        textarea.removeEventListener('blur', commit);
        textarea.remove();
        textareaRef.current = null;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      }
    });
  }, [settings, onUpdateShape, createShape, onAddShape]);

  // ── Mouse handlers ─────────────────────────────────
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Middle mouse button = pan
    if (e.evt.button === 1) { startPan(e); return; }
    // Hand tool = pan
    if (tool === 'hand') { startPan(e); return; }

    const pt = getCanvasPoint(stageRef, e);
    const clickedOnShape = e.target !== e.target.getStage();

    if (tool === 'select') {
      if (!clickedOnShape) {
        setSelectedIds([]);
        rubberStart.current = pt;
        setRubberBand({ x: pt.x, y: pt.y, w: 0, h: 0 });
      }
      return;
    }

    if (tool === 'eraser') {
      isDrawing.current = true;
      return;
    }

    if (tool === 'text') {
      openTextarea(pt.x, pt.y, null);
      return;
    }

    isDrawing.current = true;
    const base = {
      strokeColor: settings.strokeColor,
      fillColor: settings.fillColor,
      strokeWidth: tool === 'highlighter' ? 20 : settings.strokeWidth,
      opacity: tool === 'highlighter' ? 0.4 : settings.opacity,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
    };

    if (tool === 'pen' || tool === 'highlighter') {
      setActiveDrawing({ type: tool, points: [pt.x, pt.y, pt.x, pt.y], ...base });
    } else if (['line', 'arrow', 'rect', 'ellipse'].includes(tool)) {
      setActiveDrawing({ type: tool, startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y, ...base });
    }
  }, [tool, settings, getCanvasPoint, setActiveDrawing, setSelectedIds, startPan, openTextarea, isDrawing]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || (tool === 'hand' && isPanning.current)) {
      doPan(stageRef, e);
      return;
    }

    const pt = getCanvasPoint(stageRef, e);
    const raw = getRawPoint(stageRef);

    onCursorMove(pt.x, pt.y);

    if (tool === 'eraser') {
      setEraserPos({ x: raw.x, y: raw.y, visible: true });
      if (isDrawing.current) {
        const toDelete = shapes.filter((s) => {
          if (s.points && s.points.length >= 2) {
            for (let i = 0; i < s.points.length - 1; i += 2) {
              if (Math.hypot(s.points[i] - pt.x, s.points[i + 1] - pt.y) < 20) return true;
            }
            return false;
          }
          const sx = s.x ?? 0;
          const sy = s.y ?? 0;
          const sw = s.width ?? (s.radiusX ?? 0) * 2;
          const sh = s.height ?? (s.radiusY ?? 0) * 2;
          return pt.x >= sx - 10 && pt.x <= sx + sw + 10 && pt.y >= sy - 10 && pt.y <= sy + sh + 10;
        }).map((s) => s.id);
        if (toDelete.length) onDeleteShapes(toDelete);
      }
      return;
    }

    if (tool === 'select' && rubberBand) {
      setRubberBand({
        x: Math.min(rubberStart.current.x, pt.x),
        y: Math.min(rubberStart.current.y, pt.y),
        w: Math.abs(pt.x - rubberStart.current.x),
        h: Math.abs(pt.y - rubberStart.current.y),
      });
      return;
    }

    if (!isDrawing.current || !activeDrawing) return;

    if (activeDrawing.type === 'pen' || activeDrawing.type === 'highlighter') {
      const pts = activeDrawing.points!;
      const last = pts.slice(-2);
      if (Math.hypot(pt.x - last[0], pt.y - last[1]) > 3) {
        setActiveDrawing({ ...activeDrawing, points: [...pts, pt.x, pt.y] });
      }
    } else {
      setActiveDrawing({ ...activeDrawing, currentX: pt.x, currentY: pt.y });
    }
  }, [tool, activeDrawing, shapes, rubberBand, getCanvasPoint, getRawPoint, onCursorMove, onDeleteShapes, setActiveDrawing, doPan, isPanning, isDrawing]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || tool === 'hand') { endPan(); return; }
    endPan();

    if (tool === 'eraser') {
      isDrawing.current = false;
      return;
    }

    if (tool === 'select' && rubberBand) {
      const inside = shapes.filter((s) => {
        const sx = s.x ?? (s.points?.[0] ?? 0);
        const sy = s.y ?? (s.points?.[1] ?? 0);
        return (
          sx >= rubberBand.x && sx <= rubberBand.x + rubberBand.w &&
          sy >= rubberBand.y && sy <= rubberBand.y + rubberBand.h
        );
      }).map((s) => s.id);
      setSelectedIds(inside);
      setRubberBand(null);
      return;
    }

    if (!isDrawing.current || !activeDrawing) return;
    isDrawing.current = false;

    let shape: Shape | null = null;

    if (activeDrawing.type === 'pen' || activeDrawing.type === 'highlighter') {
      if ((activeDrawing.points?.length ?? 0) < 4) { setActiveDrawing(null); return; }
      shape = createShape({
        type: activeDrawing.type,
        points: activeDrawing.points,
        strokeColor: activeDrawing.strokeColor,
        fillColor: 'transparent',
        strokeWidth: activeDrawing.strokeWidth,
        opacity: activeDrawing.opacity,
      });
    } else if (activeDrawing.type === 'line' || activeDrawing.type === 'arrow') {
      shape = createShape({
        type: activeDrawing.type,
        points: [activeDrawing.startX!, activeDrawing.startY!, activeDrawing.currentX!, activeDrawing.currentY!],
        strokeColor: activeDrawing.strokeColor,
        fillColor: 'transparent',
        strokeWidth: activeDrawing.strokeWidth,
        opacity: activeDrawing.opacity,
      });
    } else if (activeDrawing.type === 'rect') {
      const x = Math.min(activeDrawing.startX!, activeDrawing.currentX!);
      const y = Math.min(activeDrawing.startY!, activeDrawing.currentY!);
      const w = Math.abs(activeDrawing.currentX! - activeDrawing.startX!);
      const h = Math.abs(activeDrawing.currentY! - activeDrawing.startY!);
      if (w < 2 || h < 2) { setActiveDrawing(null); return; }
      shape = createShape({
        type: 'rect', x, y, width: w, height: h,
        strokeColor: activeDrawing.strokeColor, fillColor: activeDrawing.fillColor,
        strokeWidth: activeDrawing.strokeWidth, opacity: activeDrawing.opacity,
      });
    } else if (activeDrawing.type === 'ellipse') {
      const rx = Math.abs(activeDrawing.currentX! - activeDrawing.startX!) / 2;
      const ry = Math.abs(activeDrawing.currentY! - activeDrawing.startY!) / 2;
      if (rx < 2 || ry < 2) { setActiveDrawing(null); return; }
      shape = createShape({
        type: 'ellipse',
        x: (activeDrawing.startX! + activeDrawing.currentX!) / 2,
        y: (activeDrawing.startY! + activeDrawing.currentY!) / 2,
        radiusX: rx, radiusY: ry,
        strokeColor: activeDrawing.strokeColor, fillColor: activeDrawing.fillColor,
        strokeWidth: activeDrawing.strokeWidth, opacity: activeDrawing.opacity,
      });
    }

    if (shape) {
      onAddShape(shape);
    }
    setActiveDrawing(null);
  }, [tool, activeDrawing, shapes, rubberBand, createShape, onAddShape, setActiveDrawing, setSelectedIds, endPan, isDrawing]);

  const handleMouseLeave = useCallback(() => {
    setEraserPos((p) => ({ ...p, visible: false }));
    if (isDrawing.current && activeDrawing) {
      // Finalize the drawing
      isDrawing.current = false;

      let shape: Shape | null = null;
      if (activeDrawing.type === 'pen' || activeDrawing.type === 'highlighter') {
        if ((activeDrawing.points?.length ?? 0) >= 4) {
          shape = createShape({
            type: activeDrawing.type, points: activeDrawing.points,
            strokeColor: activeDrawing.strokeColor, fillColor: 'transparent',
            strokeWidth: activeDrawing.strokeWidth, opacity: activeDrawing.opacity,
          });
        }
      }
      if (shape) onAddShape(shape);
      setActiveDrawing(null);
    }
  }, [activeDrawing, createShape, onAddShape, setActiveDrawing, isDrawing]);

  // ── Click handlers for shapes ──────────────────────
  const handleShapeClick = useCallback((id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    if (e.evt.shiftKey) {
      setSelectedIds(selectedIds.includes(id)
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id]);
    } else {
      setSelectedIds([id]);
    }
  }, [tool, setSelectedIds, selectedIds]);

  const handleShapeDblClick = useCallback((shape: Shape, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (shape.type !== 'text') return;
    e.cancelBubble = true;
    openTextarea(shape.x!, shape.y!, shape);
  }, [openTextarea]);

  // ── Render active (in-progress) drawing ────────────
  const renderActiveDrawing = () => {
    if (!activeDrawing) return null;
    const common = {
      stroke: activeDrawing.strokeColor,
      strokeWidth: activeDrawing.strokeWidth,
      opacity: activeDrawing.opacity,
      listening: false,
      perfectDrawEnabled: false,
    };
    if (activeDrawing.type === 'pen' || activeDrawing.type === 'highlighter') {
      return <Line {...common} points={activeDrawing.points} tension={0.5} lineCap="round" lineJoin="round" />;
    }
    if (activeDrawing.type === 'line') {
      return <Line {...common} points={[activeDrawing.startX!, activeDrawing.startY!, activeDrawing.currentX!, activeDrawing.currentY!]} lineCap="round" />;
    }
    if (activeDrawing.type === 'arrow') {
      return (
        <Arrow {...common} fill={activeDrawing.strokeColor}
          points={[activeDrawing.startX!, activeDrawing.startY!, activeDrawing.currentX!, activeDrawing.currentY!]}
          pointerLength={10} pointerWidth={8}
        />
      );
    }
    if (activeDrawing.type === 'rect') {
      const x = Math.min(activeDrawing.startX!, activeDrawing.currentX!);
      const y = Math.min(activeDrawing.startY!, activeDrawing.currentY!);
      return (
        <Rect {...common} x={x} y={y}
          width={Math.abs(activeDrawing.currentX! - activeDrawing.startX!)}
          height={Math.abs(activeDrawing.currentY! - activeDrawing.startY!)}
          fill={activeDrawing.fillColor}
        />
      );
    }
    if (activeDrawing.type === 'ellipse') {
      return (
        <Ellipse {...common}
          x={(activeDrawing.startX! + activeDrawing.currentX!) / 2}
          y={(activeDrawing.startY! + activeDrawing.currentY!) / 2}
          radiusX={Math.abs(activeDrawing.currentX! - activeDrawing.startX!) / 2}
          radiusY={Math.abs(activeDrawing.currentY! - activeDrawing.startY!) / 2}
          fill={activeDrawing.fillColor}
        />
      );
    }
    return null;
  };

  // ── Render finalized shapes ────────────────────────
  const renderShape = (shape: Shape) => {
    const common = {
      id: shape.id,
      opacity: shape.opacity,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      draggable: tool === 'select',
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleShapeClick(shape.id, e),
      onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleShapeDblClick(shape, e),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        onUpdateShape(shape.id, { x: e.target.x(), y: e.target.y() });
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        onUpdateShape(shape.id, {
          x: node.x(),
          y: node.y(),
          width: node.width() * node.scaleX(),
          height: node.height() * node.scaleY(),
          rotation: node.rotation(),
        });
        node.scaleX(1);
        node.scaleY(1);
      },
    };

    switch (shape.type) {
      case 'pen':
      case 'highlighter':
        return (
          <Line key={shape.id} {...common}
            points={shape.points} stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth} tension={0.5}
            lineCap="round" lineJoin="round"
          />
        );
      case 'line':
        return (
          <Line key={shape.id} {...common}
            points={shape.points} stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth} lineCap="round"
          />
        );
      case 'arrow':
        return (
          <Arrow key={shape.id} {...common}
            points={shape.points} stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth} fill={shape.strokeColor}
            pointerLength={10} pointerWidth={8}
          />
        );
      case 'rect':
        return (
          <Rect key={shape.id} {...common}
            x={shape.x} y={shape.y} width={shape.width} height={shape.height}
            fill={shape.fillColor} stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth} cornerRadius={2}
          />
        );
      case 'ellipse':
        return (
          <Ellipse key={shape.id} {...common}
            x={shape.x} y={shape.y}
            radiusX={shape.radiusX!} radiusY={shape.radiusY!}
            fill={shape.fillColor} stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
          />
        );
      case 'text':
        return (
          <Text key={shape.id} {...common}
            x={shape.x} y={shape.y} text={shape.text}
            fontSize={shape.fontSize} fontFamily={shape.fontFamily}
            fill={shape.strokeColor}
          />
        );
      default:
        return null;
    }
  };

  // ── Grid dots ──────────────────────────────────────
  const gridDots = React.useMemo(() => {
    const dots: React.ReactNode[] = [];
    for (let xi = 0; xi < 80; xi++) {
      for (let yi = 0; yi < 60; yi++) {
        dots.push(
          <Circle
            key={`${xi}-${yi}`}
            x={xi * 30}
            y={yi * 30}
            radius={1}
            fill="rgba(255,255,255,0.06)"
            listening={false}
            perfectDrawEnabled={false}
          />
        );
      }
    }
    return dots;
  }, []);

  return (
    <div
      className="canvas-container"
      style={{ width, height, cursor: getCursor() }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={(e) => handleWheel(stageRef, e)}
      >
        {/* Grid layer */}
        <Layer listening={false}>{gridDots}</Layer>

        {/* Shapes layer */}
        <Layer>
          {shapes.sort((a, b) => a.zIndex - b.zIndex).map(renderShape)}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            anchorFill="#7C3AED"
            anchorStroke="#7C3AED"
            borderStroke="#7C3AED"
            anchorSize={8}
            anchorCornerRadius={2}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
            }
          />
        </Layer>

        {/* Collaborator cursors layer */}
        <Layer listening={false}>
          <CollaboratorCursors cursors={cursors} />
        </Layer>

        {/* Active drawing + rubber band layer */}
        <Layer listening={false}>
          {renderActiveDrawing()}
          {rubberBand && (
            <Rect
              x={rubberBand.x} y={rubberBand.y}
              width={rubberBand.w} height={rubberBand.h}
              fill="rgba(124,58,237,0.08)"
              stroke="#7C3AED"
              strokeWidth={1}
              dash={[4, 3]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {/* Eraser cursor overlay */}
      {tool === 'eraser' && eraserPos.visible && (
        <div
          className="eraser-cursor"
          style={{
            left: eraserPos.x - 20,
            top: eraserPos.y - 20,
          }}
        />
      )}

      {/* Zoom indicator */}
      <div className="zoom-badge">{zoomLevel}%</div>
    </div>
  );
};
