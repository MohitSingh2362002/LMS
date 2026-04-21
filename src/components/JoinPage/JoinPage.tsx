import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, User, Hash, ArrowRight, Clock, Crown, Users } from 'lucide-react';
import { Button } from '../shared/Button';
import { useTokenFetch } from '../../hooks/useTokenFetch';
import { checkRoomHasHost } from '../../api/roomApi';

const RECENT_ROOMS_KEY = 'livesession_recent_rooms';
const MAX_RECENT = 5;

function getRecentRooms(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_ROOMS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentRoom(room: string) {
  const rooms = getRecentRooms().filter((r) => r !== room);
  rooms.unshift(room);
  localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(rooms.slice(0, MAX_RECENT)));
}

function validateRoomName(name: string): string | null {
  if (name.length < 2) return 'Room name must be at least 2 characters.';
  if (!/^[a-zA-Z0-9-]+$/.test(name)) return 'Only letters, numbers, and hyphens allowed.';
  return null;
}

const AVATAR_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#e91e63'];
function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function JoinPage() {
  const navigate = useNavigate();
  const { loading, error, getToken } = useTokenFetch();
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinAs, setJoinAs] = useState<'host' | 'participant'>('host');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; room?: string }>({});
  const [recentRooms, setRecentRooms] = useState<string[]>([]);

  useEffect(() => {
    setRecentRooms(getRecentRooms());
  }, []);

  const validate = (): boolean => {
    const errs: { name?: string; room?: string } = {};
    if (displayName.trim().length < 2) errs.name = 'Display name must be at least 2 characters.';
    const roomErr = validateRoomName(roomName.trim());
    if (roomErr) errs.room = roomErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const room = roomName.trim();
    const username = displayName.trim();

    if (joinAs === 'participant') {
      try {
        const hasHost = await checkRoomHasHost(room);
        if (!hasHost) {
          setFieldErrors((prev) => ({
            ...prev,
            room: 'This room is not active yet. Ask the host to join first.',
          }));
          return;
        }
      } catch (err) {
        setFieldErrors((prev) => ({
          ...prev,
          room: err instanceof Error ? err.message : 'Unable to verify room status. Please try again.',
        }));
        return;
      }
    }

    if (joinAs === 'host') {
      // Host generates token immediately
      const token = await getToken(room, username);
      if (!token) return;
      saveRecentRoom(room);
      navigate(`/room/${encodeURIComponent(room)}`, {
        state: {
          token,
          displayName: username,
          roomName: room,
          joinAs,
          userColor: getColorFromName(username),
        },
      });
    } else {
      // Participant: navigate WITHOUT token — will wait for host approval
      saveRecentRoom(room);
      navigate(`/room/${encodeURIComponent(room)}`, {
        state: {
          displayName: username,
          roomName: room,
          joinAs,
          userColor: getColorFromName(username),
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-700/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-violet-900/10 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="relative">
            <Radio size={28} className="text-brand-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse-dot border-2 border-surface-950" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">LiveSession</span>
        </div>

        {/* Card */}
        <div className="bg-surface-900/80 backdrop-blur-md border border-white/8 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h1 className="text-white text-xl font-semibold mb-1">Join a Session</h1>
          <p className="text-white/50 text-sm mb-7">Enter your details to connect in real time</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Join As Toggle */}
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">Join as</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setJoinAs('host')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    joinAs === 'host'
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/20'
                      : 'bg-surface-800 border-white/10 text-white/50 hover:text-white hover:bg-surface-700'
                  }`}
                >
                  <Crown size={15} />
                  Join as Host
                </button>
                <button
                  type="button"
                  onClick={() => setJoinAs('participant')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                    joinAs === 'participant'
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/20'
                      : 'bg-surface-800 border-white/10 text-white/50 hover:text-white hover:bg-surface-700'
                  }`}
                >
                  <Users size={15} />
                  Join as Participant
                </button>
              </div>
              <p className="text-white/30 text-xs mt-1.5">
                {joinAs === 'host'
                  ? 'You\'ll have control over whiteboard, mute, and recording.'
                  : 'You\'ll follow the host\'s controls.'}
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-white/70 text-sm font-medium mb-1.5">Display Name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alice"
                  className="w-full bg-surface-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60 transition-all"
                />
              </div>
              {fieldErrors.name && (
                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.name}</p>
              )}
            </div>

            {/* Room Name */}
            <div>
              <label className="block text-white/70 text-sm font-medium mb-1.5">Room Name</label>
              <div className="relative">
                <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="room-001"
                  className="w-full bg-surface-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60 transition-all"
                />
              </div>
              {fieldErrors.room && (
                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.room}</p>
              )}
            </div>

            {/* API Error */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center py-3 text-base"
              icon={<ArrowRight size={16} />}
            >
              {loading ? 'Connecting…' : 'Join Session'}
            </Button>
          </form>
        </div>

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 text-white/40 text-xs font-medium mb-3 px-1">
              <Clock size={12} />
              RECENTLY JOINED
            </div>
            <div className="flex flex-wrap gap-2">
              {recentRooms.map((room) => (
                <button
                  key={room}
                  onClick={() => setRoomName(room)}
                  className="px-3 py-1.5 bg-surface-800/60 border border-white/8 rounded-lg text-white/60 hover:text-white hover:bg-surface-700/60 text-xs font-mono transition-all"
                >
                  {room}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
