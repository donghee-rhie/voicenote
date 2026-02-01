import { useState, useCallback } from 'react';
import {
  Session,
  SessionCreateRequest,
  SessionUpdateRequest,
} from '@common/types/session';
import { SessionFilterIPC, IPC_CHANNELS } from '@common/types/ipc';

interface UseSessionResult {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  fetchSessions: (filter: SessionFilterIPC) => Promise<void>;
  createSession: (data: SessionCreateRequest) => Promise<Session | null>;
  updateSession: (id: string, data: SessionUpdateRequest) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  getSession: (id: string) => Promise<Session | null>;
  searchSessions: (query: string, userId: string) => Promise<void>;
}

/**
 * Custom hook for session operations via IPC
 * Manages session state and provides CRUD operations
 */
export function useSession(): UseSessionResult {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (filter: SessionFilterIPC) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SESSION.LIST,
        filter
      );

      if (!result.success) {
        throw new Error(result.error || '세션 목록 불러오기 실패');
      }

      setSessions(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '세션 목록 불러오기 실패';
      setError(errorMessage);
      console.error('Fetch sessions error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (data: SessionCreateRequest): Promise<Session | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SESSION.CREATE,
        data
      );

      if (!result.success) {
        throw new Error(result.error || '세션 생성 실패');
      }

      const newSession = result.data;
      if (newSession) {
        setSessions((prev) => [newSession, ...prev]);
      }

      return newSession || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '세션 생성 실패';
      setError(errorMessage);
      console.error('Create session error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSession = useCallback(
    async (id: string, data: SessionUpdateRequest): Promise<Session | null> => {
      setLoading(true);
      setError(null);
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API를 사용할 수 없습니다');
        }

        const result = await window.electronAPI.invoke(
          IPC_CHANNELS.SESSION.UPDATE,
          { ...data, id }
        );

        if (!result.success) {
          throw new Error(result.error || '세션 업데이트 실패');
        }

        const updatedSession = result.data;
        if (updatedSession) {
          setSessions((prev) =>
            prev.map((session) => (session.id === id ? updatedSession : session))
          );
        }

        return updatedSession || null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '세션 업데이트 실패';
        setError(errorMessage);
        console.error('Update session error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteSession = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SESSION.DELETE,
        id
      );

      if (!result.success) {
        throw new Error(result.error || '세션 삭제 실패');
      }

      setSessions((prev) => prev.filter((session) => session.id !== id));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '세션 삭제 실패';
      setError(errorMessage);
      console.error('Delete session error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSession = useCallback(async (id: string): Promise<Session | null> => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SESSION.GET,
        id
      );

      if (!result.success) {
        throw new Error(result.error || '세션 불러오기 실패');
      }

      return result.data || null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '세션 불러오기 실패';
      setError(errorMessage);
      console.error('Get session error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchSessions = useCallback(async (query: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SESSION.SEARCH,
        { query, userId }
      );

      if (!result.success) {
        throw new Error(result.error || '세션 검색 실패');
      }

      setSessions(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '세션 검색 실패';
      setError(errorMessage);
      console.error('Search sessions error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    getSession,
    searchSessions,
  };
}
