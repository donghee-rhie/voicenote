import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUserSettings = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const mockSystemSetting = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
};

vi.mock('../client', () => ({
  getDatabase: () => ({
    userSettings: mockUserSettings,
    systemSetting: mockSystemSetting,
  }),
}));

import {
  getUserSettings,
  updateUserSettings,
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
} from '../services/settings-service';

const sampleUserSettings = {
  id: 'settings-1',
  userId: 'user-1',
  pasteFormat: 'PLAIN',
  autoFormatDetection: true,
  listDetection: true,
  markdownOutput: false,
  speakerDiarization: false,
  viewMode: 'LIST',
  preferredSTTProvider: null,
  preferredLanguage: 'ko',
  autoSaveInterval: 30,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const sampleSystemSetting = {
  id: 'sys-1',
  key: 'app.version',
  value: '1.0.0',
  description: 'Application version',
  type: 'STRING',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('settings-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserSettings', () => {
    it('should return existing settings', async () => {
      mockUserSettings.findUnique.mockResolvedValue(sampleUserSettings);

      const result = await getUserSettings('user-1');

      expect(result).toEqual(sampleUserSettings);
      expect(mockUserSettings.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockUserSettings.create).not.toHaveBeenCalled();
    });

    it('should create default settings when none exist', async () => {
      mockUserSettings.findUnique.mockResolvedValue(null);
      mockUserSettings.create.mockResolvedValue(sampleUserSettings);

      const result = await getUserSettings('user-1');

      expect(result).toEqual(sampleUserSettings);
      expect(mockUserSettings.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockUserSettings.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });

    it('should throw on error', async () => {
      mockUserSettings.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getUserSettings('user-1')).rejects.toThrow(
        'Failed to get user settings: DB error'
      );
    });

    it('should throw unknown error for non-Error objects', async () => {
      mockUserSettings.findUnique.mockRejectedValue(undefined);

      await expect(getUserSettings('user-1')).rejects.toThrow(
        'Failed to get user settings: Unknown error'
      );
    });
  });

  describe('updateUserSettings', () => {
    it('should ensure settings exist then update', async () => {
      // getUserSettings will be called internally, which calls findUnique
      mockUserSettings.findUnique.mockResolvedValue(sampleUserSettings);
      const updated = { ...sampleUserSettings, viewMode: 'GRID' };
      mockUserSettings.update.mockResolvedValue(updated);

      const result = await updateUserSettings('user-1', { viewMode: 'GRID' });

      expect(result).toEqual(updated);
      // getUserSettings was called first
      expect(mockUserSettings.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(mockUserSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { viewMode: 'GRID' },
      });
    });

    it('should create defaults then update if settings do not exist', async () => {
      mockUserSettings.findUnique.mockResolvedValue(null);
      mockUserSettings.create.mockResolvedValue(sampleUserSettings);
      const updated = { ...sampleUserSettings, markdownOutput: true };
      mockUserSettings.update.mockResolvedValue(updated);

      const result = await updateUserSettings('user-1', { markdownOutput: true });

      expect(result).toEqual(updated);
      expect(mockUserSettings.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(mockUserSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { markdownOutput: true },
      });
    });

    it('should throw on error', async () => {
      mockUserSettings.findUnique.mockResolvedValue(sampleUserSettings);
      mockUserSettings.update.mockRejectedValue(new Error('DB error'));

      await expect(updateUserSettings('user-1', { viewMode: 'GRID' })).rejects.toThrow(
        'Failed to update user settings: DB error'
      );
    });
  });

  describe('getSystemSetting', () => {
    it('should return setting when found', async () => {
      mockSystemSetting.findUnique.mockResolvedValue(sampleSystemSetting);

      const result = await getSystemSetting('app.version');

      expect(result).toEqual(sampleSystemSetting);
      expect(mockSystemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'app.version' } });
    });

    it('should return null when not found', async () => {
      mockSystemSetting.findUnique.mockResolvedValue(null);

      const result = await getSystemSetting('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      mockSystemSetting.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getSystemSetting('key')).rejects.toThrow(
        'Failed to get system setting: DB error'
      );
    });
  });

  describe('setSystemSetting', () => {
    it('should upsert a system setting', async () => {
      mockSystemSetting.upsert.mockResolvedValue(sampleSystemSetting);

      const result = await setSystemSetting('app.version', '1.0.0', 'Application version', 'STRING');

      expect(result).toEqual(sampleSystemSetting);
      expect(mockSystemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'app.version' },
        update: {
          value: '1.0.0',
          description: 'Application version',
          type: 'STRING',
        },
        create: {
          key: 'app.version',
          value: '1.0.0',
          description: 'Application version',
          type: 'STRING',
        },
      });
    });

    it('should handle optional parameters as undefined', async () => {
      mockSystemSetting.upsert.mockResolvedValue({ ...sampleSystemSetting, value: undefined });

      await setSystemSetting('app.key');

      expect(mockSystemSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'app.key' },
        update: {
          value: undefined,
          description: undefined,
          type: undefined,
        },
        create: {
          key: 'app.key',
          value: undefined,
          description: undefined,
          type: undefined,
        },
      });
    });

    it('should throw on error', async () => {
      mockSystemSetting.upsert.mockRejectedValue(new Error('DB error'));

      await expect(setSystemSetting('key', 'val')).rejects.toThrow(
        'Failed to set system setting: DB error'
      );
    });
  });

  describe('getAllSystemSettings', () => {
    it('should return all settings ordered by key', async () => {
      const settings = [sampleSystemSetting];
      mockSystemSetting.findMany.mockResolvedValue(settings);

      const result = await getAllSystemSettings();

      expect(result).toEqual(settings);
      expect(mockSystemSetting.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });

    it('should return empty array when no settings exist', async () => {
      mockSystemSetting.findMany.mockResolvedValue([]);

      const result = await getAllSystemSettings();

      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      mockSystemSetting.findMany.mockRejectedValue(new Error('DB error'));

      await expect(getAllSystemSettings()).rejects.toThrow(
        'Failed to get all system settings: DB error'
      );
    });
  });
});
