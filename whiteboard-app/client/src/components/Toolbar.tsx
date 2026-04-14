import React from 'react';
import { Tool, DrawingSettings } from '../types';

interface Props {
  tool: Tool;
  setTool: (tool: Tool) => void;
  settings: DrawingSettings;
  setSettings: (s: DrawingSettings) => void;
}

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'hand',        label: 'Hand',      icon: '✋' },
  { id: 'select',      label: 'Select',    icon: '⬡' },
  { id: 'pen',         label: 'Pen',       icon: '✏️' },
  { id: 'highlighter', label: 'Highlight', icon: '🖊️' },
  { id: 'eraser',      label: 'Eraser',    icon: '⬜' },
  { id: 'line',        label: 'Line',      icon: '╱' },
  { id: 'arrow',       label: 'Arrow',     icon: '→' },
  { id: 'rect',        label: 'Rect',      icon: '▭' },
  { id: 'ellipse',     label: 'Ellipse',   icon: '◯' },
  { id: 'text',        label: 'Text',      icon: 'T' },
];

const STROKE_COLORS = [
  '#ffffff', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
  '#1abc9c', '#95a5a6',
];

const FILL_COLORS = [
  'transparent', '#e74c3c', '#e67e22', '#f1c40f',
  '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
  '#1abc9c', '#ffffff',
];

export const Toolbar: React.FC<Props> = ({ tool, setTool, settings, setSettings }) => {
  return (
    <div className="toolbar">
      {/* Tool buttons */}
      <div className="toolbar-section">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <span className="tool-icon">{t.icon}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Stroke color */}
      <div className="toolbar-section">
        <span className="toolbar-label">Stroke</span>
        <div className="color-grid">
          {STROKE_COLORS.map((c) => (
            <button
              key={`s-${c}`}
              className={`color-swatch ${settings.strokeColor === c ? 'selected' : ''}`}
              style={{
                background: c === 'transparent' ? 'linear-gradient(135deg, #fff 40%, #ff4444 50%, #fff 60%)' : c,
              }}
              onClick={() => setSettings({ ...settings, strokeColor: c })}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Fill color */}
      <div className="toolbar-section">
        <span className="toolbar-label">Fill</span>
        <div className="color-grid">
          {FILL_COLORS.map((c) => (
            <button
              key={`f-${c}`}
              className={`color-swatch ${settings.fillColor === c ? 'selected' : ''}`}
              style={{
                background: c === 'transparent' ? 'linear-gradient(135deg, #fff 40%, #ff4444 50%, #fff 60%)' : c,
              }}
              onClick={() => setSettings({ ...settings, fillColor: c })}
              title={c === 'transparent' ? 'None' : c}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Stroke width */}
      <div className="toolbar-section">
        <span className="toolbar-label">Size</span>
        <input
          type="range"
          min={1}
          max={30}
          value={settings.strokeWidth}
          onChange={(e) => setSettings({ ...settings, strokeWidth: parseInt(e.target.value) })}
          className="stroke-slider"
        />
        <span className="stroke-value">{settings.strokeWidth}px</span>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Opacity */}
      <div className="toolbar-section">
        <span className="toolbar-label">Opacity</span>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(settings.opacity * 100)}
          onChange={(e) => setSettings({ ...settings, opacity: parseInt(e.target.value) / 100 })}
          className="stroke-slider"
        />
        <span className="stroke-value">{Math.round(settings.opacity * 100)}%</span>
      </div>
    </div>
  );
};
