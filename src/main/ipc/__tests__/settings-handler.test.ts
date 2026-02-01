import { vi, describe, it, expect, beforeEach } from 'vitest';

// Capture registered IPC handlers
const registeredHandlers: Record<string, Function> = {};

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      registeredHandlers[channel] = handler;
    }),
  },
}));

vi.mock('../../database', () => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  getSystemSetting: vi.fn(),
  setSystemSetting: vi.fn(),
  getAllSystemSettings: vi.fn(),
}));

import { ipcMain } from 'electron';
import {
  getUserSettings,
  updateUserSettings,
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
} from '../../database';
import { registerSettingsHandlers } from '../settings-handler';
import { IPC_CHANNELS } from '../../../common/types/ipc';

const mockEvent = {} as Electron.IpcMainInvokeEvent;

const mockUserSettings = {
  id: 'settings-1',
  userId: 'user-1',
  pasteFormat: 'FORMATTED',
  autoFormatDetection: true,
  listDetection: true,
  markdownOutput: false,
  speakerDiarization: false,
  viewMode: 'timeline',
  preferredSTTProvider: 'groq',
  preferredLanguage: 'ko-KR',
  autoSaveInterval: 5000,
  sttModel: 'whisper-large-v3-turbo',
  refineModel: 'llama-3.3-70b-versatile',
  maxRecordingDuration: 300,
  autoCopyOnComplete: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockSystemSetting = {
  id: 'sys-1',
  key: 'app.version',
  value: '1.0.0',
  description: 'Application version',
  type: 'string',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Settings Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(registeredHandlers).forEach((key) => delete registeredHandlers[key]);
    registerSettingsHandlers();
  });

  describe('registerSettingsHandlers', () => {
    it('should register all expected IPC channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SETTINGS.GET, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SETTINGS.UPDATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SETTINGS.SYSTEM_GET, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SETTINGS.SYSTEM_UPDATE, expect.any(Function));
    });
  });

  describe('settings:get', () => {
    it('should return user settings', async () => {
      vi.mocked(getUserSettings).mockResolvedValue(mockUserSettings);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.GET](mockEvent, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUserSettings);
      expect(getUserSettings).toHaveBeenCalledWith('user-1');
    });

    it('should fail when settings are not found', async () => {
      vi.mocked(getUserSettings).mockResolvedValue(null as any);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.GET](mockEvent, 'user-999');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings not found');
    });

    it('should fail when userId is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.GET](mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(getUserSettings).mockRejectedValue(new Error('DB error'));

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.GET](mockEvent, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('settings:update', () => {
    it('should update user settings', async () => {
      const updatedSettings = { ...mockUserSettings, viewMode: 'grid' };
      vi.mocked(updateUserSettings).mockResolvedValue(updatedSettings);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.UPDATE](mockEvent, 'user-1', {
        viewMode: 'grid',
      });

      expect(result.success).toBe(true);
      expect(result.data.viewMode).toBe('grid');
      expect(updateUserSettings).toHaveBeenCalledWith('user-1', { viewMode: 'grid' });
    });

    it('should fail when userId is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.UPDATE](mockEvent, '', {
        viewMode: 'grid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(updateUserSettings).mockRejectedValue(new Error('Update failed'));

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.UPDATE](mockEvent, 'user-1', {
        viewMode: 'grid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('settings:system-get', () => {
    it('should return a single system setting by key', async () => {
      vi.mocked(getSystemSetting).mockResolvedValue(mockSystemSetting);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_GET](mockEvent, 'app.version');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSystemSetting);
      expect(getSystemSetting).toHaveBeenCalledWith('app.version');
    });

    it('should return all system settings when no key provided', async () => {
      const allSettings = [mockSystemSetting];
      vi.mocked(getAllSystemSettings).mockResolvedValue(allSettings);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_GET](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(allSettings);
      expect(getAllSystemSettings).toHaveBeenCalled();
    });

    it('should fail when system setting key is not found', async () => {
      vi.mocked(getSystemSetting).mockResolvedValue(null);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_GET](mockEvent, 'nonexistent.key');

      expect(result.success).toBe(false);
      expect(result.error).toBe("System setting 'nonexistent.key' not found");
    });

    it('should handle database error', async () => {
      vi.mocked(getAllSystemSettings).mockRejectedValue(new Error('DB error'));

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_GET](mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('settings:system-update', () => {
    it('should update a system setting', async () => {
      vi.mocked(setSystemSetting).mockResolvedValue(mockSystemSetting);

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_UPDATE](mockEvent, {
        key: 'app.version',
        value: '2.0.0',
        description: 'Application version',
        type: 'string',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSystemSetting);
      expect(setSystemSetting).toHaveBeenCalledWith('app.version', '2.0.0', 'Application version', 'string');
    });

    it('should fail when key is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_UPDATE](mockEvent, {
        key: '',
        value: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Setting key is required');
    });

    it('should handle database error', async () => {
      vi.mocked(setSystemSetting).mockRejectedValue(new Error('Write failed'));

      const result = await registeredHandlers[IPC_CHANNELS.SETTINGS.SYSTEM_UPDATE](mockEvent, {
        key: 'app.version',
        value: '2.0.0',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });
  });
});
