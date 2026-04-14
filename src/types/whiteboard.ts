export type WhiteboardTool =
  | 'select' | 'hand'
  | 'pen' | 'highlighter' | 'eraser'
  | 'line' | 'arrow'
  | 'rect' | 'ellipse'
  | 'text';

export interface WBShape {
  id: string;
  type: WhiteboardTool;
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

export interface WBActiveDrawing {
  type: WhiteboardTool;
  points?: number[];
  startX?: number;
  startY?: number;
  currentX?: number;
  currentY?: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface WBCollaboratorCursor {
  socketId: string;
  x: number;
  y: number;
  name: string;
  color: string;
}

export interface WBDrawingSettings {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
}
