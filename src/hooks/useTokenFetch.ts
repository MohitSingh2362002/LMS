import { useState, useCallback } from 'react';
import { fetchToken } from '../api/tokenApi';

interface UseTokenFetchResult {
  token: string | null;
  loading: boolean;
  error: string | null;
  getToken: (room: string, username: string) => Promise<string | null>;
}

export function useTokenFetch(): UseTokenFetchResult {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (room: string, username: string): Promise<string | null> => {
    setLoading(true);
    setError(null);
    setToken(null);
    try {
      const t = await fetchToken(room, username);
      setToken(t);
      return t;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { token, loading, error, getToken };
}
