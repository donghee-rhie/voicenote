import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { ApiKeyType } from '../../common/types/ipc';
import { getApiKey, setApiKey, deleteApiKey, hasApiKey } from '../services/api-key-service';

/**
 * Register API key management IPC handlers
 */
export function registerApiKeyHandlers() {
  // Get API key info (masked, never returns actual key)
  ipcMain.handle(IPC_CHANNELS.API_KEY.GET, async (_event, type: ApiKeyType) => {
    try {
      if (!type || !['groq', 'elevenlabs'].includes(type)) {
        return { success: false, error: 'Invalid API key type' };
      }

      const info = hasApiKey(type);
      return {
        success: true,
        data: info,
      };
    } catch (error) {
      console.error('Get API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get API key info',
      };
    }
  });

  // Set API key
  ipcMain.handle(IPC_CHANNELS.API_KEY.SET, async (_event, type: ApiKeyType, key: string) => {
    try {
      if (!type || !['groq', 'elevenlabs'].includes(type)) {
        return { success: false, error: 'Invalid API key type' };
      }

      if (!key || key.trim().length === 0) {
        return { success: false, error: 'API key is required' };
      }

      setApiKey(type, key.trim());

      return {
        success: true,
        data: hasApiKey(type),
      };
    } catch (error) {
      console.error('Set API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set API key',
      };
    }
  });

  // Delete API key
  ipcMain.handle(IPC_CHANNELS.API_KEY.DELETE, async (_event, type: ApiKeyType) => {
    try {
      if (!type || !['groq', 'elevenlabs'].includes(type)) {
        return { success: false, error: 'Invalid API key type' };
      }

      deleteApiKey(type);

      return { success: true };
    } catch (error) {
      console.error('Delete API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete API key',
      };
    }
  });

  // Validate API key (basic check)
  ipcMain.handle(IPC_CHANNELS.API_KEY.VALIDATE, async (_event, type: ApiKeyType, key: string) => {
    try {
      if (!type || !['groq', 'elevenlabs'].includes(type)) {
        return { success: false, error: 'Invalid API key type' };
      }

      if (!key || key.trim().length === 0) {
        return { success: false, error: 'API key is required' };
      }

      // Basic format validation
      const trimmedKey = key.trim();
      let valid = false;
      let message = '';

      switch (type) {
        case 'groq':
          valid = trimmedKey.startsWith('gsk_') && trimmedKey.length > 20;
          message = valid ? 'Groq API 키 형식이 올바릅니다' : 'Groq API 키는 gsk_로 시작해야 합니다';
          break;
        case 'elevenlabs':
          valid = trimmedKey.length > 20;
          message = valid ? 'ElevenLabs API 키 형식이 올바릅니다' : 'API 키가 너무 짧습니다';
          break;
      }

      return {
        success: true,
        data: { valid, message },
      };
    } catch (error) {
      console.error('Validate API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate API key',
      };
    }
  });
}
