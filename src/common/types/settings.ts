/**
 * Settings-related types and interfaces
 */

// User settings interface
export interface UserSettings {
  id: string;
  userId: string;
  pasteFormat: 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';
  autoFormatDetection: boolean;
  listDetection: boolean;
  markdownOutput: boolean;
  speakerDiarization: boolean;
  viewMode: 'timeline' | 'list';
  preferredSTTProvider: 'groq' | 'elevenlabs';
  preferredLanguage: string;
  autoSaveInterval: number; // milliseconds
  // Model settings
  sttModel?: string; // STT model ID
  refineModel?: string; // LLM refinement model ID
  // Recording settings
  maxRecordingDuration?: number; // 최대 녹음 시간 (초), 기본 300초
  autoCopyOnComplete?: boolean; // 전사 완료 시 자동 복사
}

// System setting type enumeration
export type SystemSettingType = 'string' | 'number' | 'boolean' | 'json';

// System setting interface
export interface SystemSetting {
  id: string;
  key: string;
  value?: string;
  description?: string;
  type: SystemSettingType;
}
