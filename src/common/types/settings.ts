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
  preferredSTTProvider: 'groq' | 'elevenlabs' | 'fireworks';
  preferredLanguage: string;
  autoSaveInterval: number; // milliseconds
  // Model settings
  sttModel?: string; // STT model ID
  refineModel?: string; // LLM refinement model ID
  preferredLLMProvider?: 'groq' | 'fireworks' | 'openai' | 'anthropic'; // LLM provider for refinement
  // Recording settings
  maxRecordingDuration?: number; // 최대 녹음 시간 (초), 기본 300초
  autoCopyOnComplete?: boolean; // 전사 완료 시 자동 복사
  // Translation & Minutes settings
  translationTargetLanguage?: string; // 번역 타겟 언어 (기본: en)
  translationLLMProvider?: 'groq' | 'fireworks' | 'openai' | 'anthropic'; // 번역용 LLM 프로바이더
  translationModel?: string; // 번역용 LLM 모델 (미설정 시 refineModel 사용)
  minutesLLMProvider?: 'groq' | 'fireworks' | 'openai' | 'anthropic'; // 구조화 정리용 LLM 프로바이더
  minutesModel?: string; // 구조화 정리용 LLM 모델 (미설정 시 refineModel 사용)
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
