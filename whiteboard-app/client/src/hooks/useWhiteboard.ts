import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Shape, ActiveDrawing, Tool, DrawingSettings } from '../types';

export const useWhiteboard = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [activeDrawing, setActiveDrawing] = useState<ActiveDrawing | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [settings, setSettings] = useState<DrawingSettings>({
    strokeColor: '#ffffff',
    fillColor: 'transparent',
    strokeWidth: 3,
    opacity: 1,
    fontSize: 20,
    fontFamily: 'Inter, sans-serif',
  });
  const isDrawing = useRef(false);
  const zIndexCounter = useRef(0);

  const addShape = useCallback((shape: Shape) => {
    setShapes(prev => [...prev, shape]);
  }, []);

  const updateShapeLocal = useCallback((id: string, updates: Partial<Shape>) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteShapesLocal = useCallback((ids: string[]) => {
    setShapes(prev => prev.filter(s => !ids.includes(s.id)));
  }, []);

  const initShapes = useCallback((newShapes: Shape[]) => {
    setShapes(newShapes);
  }, []);

  const nextZIndex = useCallback(() => {
    zIndexCounter.current += 1;
    return zIndexCounter.current;
  }, []);

  const createShape = useCallback((partial: Partial<Shape>): Shape => ({
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
  } as Shape), [tool, settings, nextZIndex]);

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
