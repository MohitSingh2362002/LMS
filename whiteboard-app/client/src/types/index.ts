export type Tool =
  | 'select' | 'hand'
  | 'pen' | 'highlighter' | 'eraser'
  | 'line' | 'arrow'
  | 'rect' | 'ellipse'
  | 'text';

export interface Shape {
  id: string;
  type: Tool;
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

export interface ActiveDrawing {
  type: Tool;
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

export interface CollaboratorCursor {
  socketId: string;
  x: number;
  y: number;
  name: string;
  color: string;
}

export interface DrawingSettings {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
}
