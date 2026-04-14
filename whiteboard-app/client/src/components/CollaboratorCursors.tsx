import React from 'react';
import { Group, Circle, Text } from 'react-konva';
import { CollaboratorCursor } from '../types';

interface Props {
  cursors: CollaboratorCursor[];
}

export const CollaboratorCursors: React.FC<Props> = ({ cursors }) => (
  <>
    {cursors.map((c) => (
      <Group key={c.socketId} x={c.x} y={c.y}>
        {/* Cursor dot */}
        <Circle radius={6} fill={c.color} opacity={0.9} />
        {/* Glow ring */}
        <Circle radius={10} stroke={c.color} strokeWidth={1.5} opacity={0.3} />
        {/* Name label */}
        <Text
          text={c.name}
          fontSize={11}
          fill="#ffffff"
          x={14}
          y={-8}
          fontFamily="Inter, sans-serif"
          padding={3}
        />
      </Group>
    ))}
  </>
);
