import { getDatabase } from '../client';
import type { UserSettings, SystemSetting } from '@prisma/client';

export interface UpdateUserSettingsData {
  pasteFormat?: string;
  autoFormatDetection?: boolean;
  listDetection?: boolean;
  markdownOutput?: boolean;
  speakerDiarization?: boolean;
  viewMode?: string;
  preferredSTTProvider?: string;
  preferredLanguage?: string;
  autoSaveInterval?: number;
}

export interface CreateSystemSettingData {
  key: string;
  value?: string;
  description?: string;
  type?: string;
}

/**
 * Get user settings by user ID, creating default settings if they don't exist
 */
export async function getUserSettings(
  userId: string
): Promise<UserSettings> {
  try {
    const db = getDatabase();
    
    // upsert를 사용하여 race condition 방지
    const settings = await db.userSettings.upsert({
      where: { userId },
      update: {}, // 이미 존재하면 아무것도 업데이트하지 않음
      create: {
        userId,
      },
    });

    return settings;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get user settings: ${error.message}`);
    }
    throw new Error('Failed to get user settings: Unknown error');
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  data: UpdateUserSettingsData
): Promise<UserSettings> {
  try {
    const db = getDatabase();

    // Ensure settings exist first
    await getUserSettings(userId);

    return await db.userSettings.update({
      where: { userId },
      data,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update user settings: ${error.message}`);
    }
    throw new Error('Failed to update user settings: Unknown error');
  }
}

/**
 * Get a system setting by key
 */
export async function getSystemSetting(
  key: string
): Promise<SystemSetting | null> {
  try {
    const db = getDatabase();
    return await db.systemSetting.findUnique({
      where: { key },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get system setting: ${error.message}`);
    }
    throw new Error('Failed to get system setting: Unknown error');
  }
}

/**
 * Set a system setting (create or update)
 */
export async function setSystemSetting(
  key: string,
  value?: string,
  description?: string,
  type?: string
): Promise<SystemSetting> {
  try {
    const db = getDatabase();
    return await db.systemSetting.upsert({
      where: { key },
      update: {
        value,
        description,
        type,
      },
      create: {
        key,
        value,
        description,
        type,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to set system setting: ${error.message}`);
    }
    throw new Error('Failed to set system setting: Unknown error');
  }
}

/**
 * Get all system settings
 */
export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  try {
    const db = getDatabase();
    return await db.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get all system settings: ${error.message}`);
    }
    throw new Error('Failed to get all system settings: Unknown error');
  }
}
