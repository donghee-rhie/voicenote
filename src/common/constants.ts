/**
 * Application-wide constants
 */

// Recording limits
export const MAX_RECORDING_DURATION = 3600000; // 1 hour in milliseconds

// File size limits
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'm4a', 'ogg', 'webm'] as const;

// Default settings
export const DEFAULT_LANGUAGE = 'ko-KR';
export const DEFAULT_STT_PROVIDER = 'openai' as const;
export const DEFAULT_FORMAT_TYPE = 'FORMATTED' as const;
