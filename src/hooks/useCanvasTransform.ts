import { useState, useRef } from 'react';
import Konva from 'konva';

export const useCanvasTransform = () => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });

  const getCanvasPoint = (
    stageRef: React.RefObject<Konva.Stage>,
    _e: Konva.KonvaEventObject<MouseEvent>
  ) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  };

  const getRawPoint = (stageRef: React.RefObject<Konva.Stage>) => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    return stage.getPointerPosition() || { x: 0, y: 0 };
  };

  const handleWheel = (
    stageRef: React.RefObject<Konva.Stage>,
    e: Konva.KonvaEventObject<WheelEvent>
  ) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(
      Math.max(direction > 0 ? oldScale * 1.05 : oldScale / 1.05, 0.1),
      5
    );

    stage.scale({ x: newScale, y: newScale });
    stage.x(pointer.x - mousePointTo.x * newScale);
    stage.y(pointer.y - mousePointTo.y * newScale);
    stage.batchDraw();
    setZoomLevel(Math.round(newScale * 100));
  };

  const startPan = (e: Konva.KonvaEventObject<MouseEvent>) => {
    isPanning.current = true;
    const stage = e.target.getStage()!;
    const pos = stage.getPointerPosition()!;
    lastPanPoint.current = { x: pos.x, y: pos.y };
  };

  const doPan = (
    stageRef: React.RefObject<Konva.Stage>,
    _e: Konva.KonvaEventObject<MouseEvent>
  ) => {
    if (!isPanning.current) return;
    const stage = stageRef.current!;
    const pos = stage.getPointerPosition()!;
    const dx = pos.x - lastPanPoint.current.x;
    const dy = pos.y - lastPanPoint.current.y;
    stage.x(stage.x() + dx);
    stage.y(stage.y() + dy);
    stage.batchDraw();
    lastPanPoint.current = { x: pos.x, y: pos.y };
  };

  const endPan = () => {
    isPanning.current = false;
  };

  return {
    zoomLevel,
    getCanvasPoint,
    getRawPoint,
    handleWheel,
    startPan,
    doPan,
    endPan,
    isPanning,
  };
};
