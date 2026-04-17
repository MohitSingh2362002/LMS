const WHITEBOARD_SERVER_URL = import.meta.env.VITE_WHITEBOARD_SOCKET_URL || 'http://localhost:3001';

interface RoomHostStatusResponse {
  hasHost: boolean;
}

export async function checkRoomHasHost(room: string): Promise<boolean> {
  const url = `${WHITEBOARD_SERVER_URL}/rooms/${encodeURIComponent(room)}/host-status`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to verify room host status. Please try again.');
  }

  const data = (await response.json()) as RoomHostStatusResponse;
  return Boolean(data.hasHost);
}
