import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserSettings } from '@common/types/settings';
import { IPC_CHANNELS } from '@common/types/ipc';
import { useAuth } from './AuthContext';

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Load settings when user is available
  useEffect(() => {
    if (user?.id) {
      loadSettings(user.id);
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [user?.id]);

  const loadSettings = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SETTINGS.GET,
        userId
      );

      if (!result.success) {
        throw new Error(result.error || '설정 불러오기 실패');
      }

      setSettings(result.data || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정 불러오기 실패';
      setError(errorMessage);
      console.error('Load settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (partial: Partial<UserSettings>) => {
    if (!user?.id) {
      throw new Error('사용자 정보가 없습니다');
    }

    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API를 사용할 수 없습니다');
      }

      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.SETTINGS.UPDATE,
        user.id,
        partial
      );

      if (!result.success) {
        throw new Error(result.error || '설정 업데이트 실패');
      }

      setSettings(result.data || { ...settings, ...partial } as UserSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '설정 업데이트 실패';
      setError(errorMessage);
      console.error('Update settings error:', err);
      throw err;
    }
  };

  const refreshSettings = async () => {
    if (user?.id) {
      await loadSettings(user.id);
    }
  };

  return (
    <SettingsContext.Provider
      value={{ settings, loading, error, updateSettings, refreshSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
