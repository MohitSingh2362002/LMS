import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { WBShape, WBActiveDrawing, WhiteboardTool, WBDrawingSettings } from '../types/whiteboard';

export const useWhiteboardState = () => {
  const [shapes, setShapes] = useState<WBShape[]>([]);
  const [activeDrawing, setActiveDrawing] = useState<WBActiveDrawing | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [settings, setSettings] = useState<WBDrawingSettings>({
    strokeColor: '#ffffff',
    fillColor: 'transparent',
    strokeWidth: 3,
    opacity: 1,
    fontSize: 20,
    fontFamily: 'Inter, sans-serif',
  });
  const isDrawing = useRef(false);
  const zIndexCounter = useRef(0);

  const addShape = useCallback((shape: WBShape) => {
    setShapes((prev) => [...prev, shape]);
  }, []);

  const updateShapeLocal = useCallback((id: string, updates: Partial<WBShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const deleteShapesLocal = useCallback((ids: string[]) => {
    setShapes((prev) => prev.filter((s) => !ids.includes(s.id)));
  }, []);

  const initShapes = useCallback((newShapes: WBShape[]) => {
    setShapes(newShapes);
  }, []);

  const nextZIndex = useCallback(() => {
    zIndexCounter.current += 1;
    return zIndexCounter.current;
  }, []);

  const createShape = useCallback(
    (partial: Partial<WBShape>): WBShape =>
      ({
        id: uuidv4(),
        type: tool,
        strokeColor: settings.strokeColor,
        fillColor: settings.fillColor,
        strokeWidth: settings.strokeWidth,
        opacity: settings.opacity,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        zIndex: nextZIndex(),
        ...partial,
      } as WBShape),
    [tool, settings, nextZIndex]
  );

  return {
    shapes,
    activeDrawing,
    setActiveDrawing,
    selectedIds,
    setSelectedIds,
    tool,
    setTool,
    settings,
    setSettings,
    isDrawing,
    addShape,
    updateShapeLocal,
    deleteShapesLocal,
    initShapes,
    createShape,
  };
};
