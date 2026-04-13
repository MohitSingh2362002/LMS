import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SessionProvider } from './context/SessionContext';
import { JoinPage } from './components/JoinPage/JoinPage';
import { RoomPage } from './components/Room/RoomPage';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/room/:roomName" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '13px',
              fontFamily: '"DM Sans", sans-serif',
            },
            success: {
              iconTheme: { primary: '#7c3aed', secondary: '#fff' },
            },
          }}
        />
      </SessionProvider>
    </BrowserRouter>
  );
}
