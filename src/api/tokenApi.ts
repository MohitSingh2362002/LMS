import CryptoJS from 'crypto-js';

const LIVEKIT_API_KEY = import.meta.env.VITE_LIVEKIT_API_KEY as string;
const LIVEKIT_API_SECRET = import.meta.env.VITE_LIVEKIT_API_SECRET as string;

/**
 * Base64URL-encode a regular string (UTF-8).
 */
function base64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL-encode a CryptoJS WordArray (binary data).
 */
function base64urlFromWords(words: CryptoJS.lib.WordArray): string {
  return CryptoJS.enc.Base64.stringify(words)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a LiveKit-compatible JWT access token using pure JS crypto.
 * Works on HTTP (no crypto.subtle / secure-context required).
 */
export async function fetchToken(room: string, username: string): Promise<string> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error(
      'LiveKit API Key or Secret is not configured. ' +
      'Set VITE_LIVEKIT_API_KEY and VITE_LIVEKIT_API_SECRET in your .env file.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = 6 * 60 * 60; // 6 hours

  // JWT Header
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  // JWT Payload — matches LiveKit server-sdk claim structure
  const payload = base64url(JSON.stringify({
    iss: LIVEKIT_API_KEY,
    sub: username,
    name: username,
    jti: username,
    iat: now,
    nbf: now,
    exp: now + ttl,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    metadata: '',
  }));

  // HMAC-SHA256 signature (pure JS — no crypto.subtle needed)
  const signature = CryptoJS.HmacSHA256(`${header}.${payload}`, LIVEKIT_API_SECRET);
  const sig = base64urlFromWords(signature);

  const token = `${header}.${payload}.${sig}`;

  console.log('[TokenGen] Token generated for room:', room, 'user:', username);
  return token;
}
