import React from 'react';

interface Props {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClear: () => void;
  onExport: () => void;
  hasSelection: boolean;
  roomId: string;
  userName: string;
}

export const ActionBar: React.FC<Props> = ({
  onUndo, onRedo, onDelete, onClear, onExport,
  hasSelection, roomId, userName,
}) => {
  return (
    <div className="action-bar">
      <div className="action-bar-left">
        <div className="room-badge">
          <span className="room-dot" />
          <span className="room-label">{roomId}</span>
        </div>
        <span className="user-badge">{userName}</span>
      </div>

      <div className="action-bar-center">
        <button className="action-btn" onClick={onUndo} title="Undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        <button className="action-btn" onClick={onRedo} title="Redo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
        </button>

        <div className="action-divider" />

        <button
          className="action-btn danger"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete Selected"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>

        <button className="action-btn danger" onClick={onClear} title="Clear All">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>

        <div className="action-divider" />

        <button className="action-btn export" onClick={onExport} title="Export PNG">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      <div className="action-bar-right" />
    </div>
  );
};
