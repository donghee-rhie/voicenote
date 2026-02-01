import { useState, useCallback } from 'react';

interface UseElectronAPIResult<T = any> {
  invoke: (channel: string, ...args: any[]) => Promise<T>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for making IPC calls to the main process with loading and error state management
 *
 * @example
 * const { invoke, loading, error } = useElectronAPI<SessionData>();
 * const session = await invoke('session:get', sessionId);
 */
export function useElectronAPI<T = any>(): UseElectronAPIResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(async (channel: string, ...args: any[]): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      if (!window.electronAPI) {
        throw new Error('Electron API is not available');
      }

      const result = await window.electronAPI.invoke(channel, ...args);
      return result as T;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { invoke, loading, error };
}

/**
 * Type-safe wrapper for direct IPC invocation without state management
 */
export async function invokeElectron<T = any>(
  channel: string,
  ...args: any[]
): Promise<T> {
  if (!window.electronAPI) {
    throw new Error('Electron API is not available');
  }
  return window.electronAPI.invoke(channel, ...args) as Promise<T>;
}

/**
 * Subscribe to IPC events from the main process
 *
 * @example
 * useEffect(() => {
 *   const unsubscribe = subscribeElectron('audio:recording-state', (state) => {
 *     console.log('Recording state:', state);
 *   });
 *   return unsubscribe;
 * }, []);
 */
export function subscribeElectron(
  channel: string,
  callback: (...args: any[]) => void
): () => void {
  if (!window.electronAPI) {
    console.warn('Electron API is not available');
    return () => {};
  }
  return window.electronAPI.on(channel, callback);
}

/**
 * Send a one-way message to the main process
 */
export function sendElectron(channel: string, ...args: any[]): void {
  if (!window.electronAPI) {
    console.warn('Electron API is not available');
    return;
  }
  window.electronAPI.send(channel, ...args);
}
