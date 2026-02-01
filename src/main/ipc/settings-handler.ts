import { ipcMain } from 'electron';
import {
  getUserSettings,
  updateUserSettings,
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
} from '../database';
import type { UpdateUserSettingsData, CreateSystemSettingData } from '../database';
import { IPC_CHANNELS } from '../../common/types/ipc';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers() {
  // Get user settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async (_event, userId: string) => {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      const settings = await getUserSettings(userId);

      if (!settings) {
        return {
          success: false,
          error: 'Settings not found',
        };
      }

      return {
        success: true,
        data: settings,
      };
    } catch (error) {
      console.error('Get user settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user settings',
      };
    }
  });

  // Update user settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS.UPDATE, async (_event, userId: string, data: UpdateUserSettingsData) => {
    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      const settings = await updateUserSettings(userId, data);

      return {
        success: true,
        data: settings,
      };
    } catch (error) {
      console.error('Update user settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user settings',
      };
    }
  });

  // Get system settings (single or all)
  ipcMain.handle(IPC_CHANNELS.SETTINGS.SYSTEM_GET, async (_event, key?: string) => {
    try {
      if (key) {
        // Get single setting
        const setting = await getSystemSetting(key);

        if (!setting) {
          return {
            success: false,
            error: `System setting '${key}' not found`,
          };
        }

        return {
          success: true,
          data: setting,
        };
      } else {
        // Get all settings
        const settings = await getAllSystemSettings();

        return {
          success: true,
          data: settings,
        };
      }
    } catch (error) {
      console.error('Get system settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system settings',
      };
    }
  });

  // Update system setting
  ipcMain.handle(IPC_CHANNELS.SETTINGS.SYSTEM_UPDATE, async (_event, data: CreateSystemSettingData) => {
    try {
      if (!data.key) {
        return {
          success: false,
          error: 'Setting key is required',
        };
      }

      const setting = await setSystemSetting(
        data.key,
        data.value,
        data.description,
        data.type
      );

      return {
        success: true,
        data: setting,
      };
    } catch (error) {
      console.error('Update system setting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update system setting',
      };
    }
  });
}
