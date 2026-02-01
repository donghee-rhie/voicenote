/**
 * IPC Channel definitions and related types
 */

// IPC Channel constants grouped by domain
export const IPC_CHANNELS = {
  AUDIO: {
    START_RECORDING: 'audio:start-recording',
    STOP_RECORDING: 'audio:stop-recording',
    RECORDING_STATE: 'audio:recording-state',
    SAVE_BLOB: 'audio:save-blob',
    GET_FILE: 'audio:get-file',
  },
  TRANSCRIPTION: {
    START: 'transcription:start',
    PROGRESS: 'transcription:progress',
    COMPLETE: 'transcription:complete',
    ERROR: 'transcription:error',
  },
  REFINEMENT: {
    START: 'refinement:start',
    COMPLETE: 'refinement:complete',
    ERROR: 'refinement:error',
  },
  SESSION: {
    CREATE: 'session:create',
    UPDATE: 'session:update',
    DELETE: 'session:delete',
    GET: 'session:get',
    LIST: 'session:list',
    SEARCH: 'session:search',
  },
  USER: {
    LOGIN: 'user:login',
    LIST: 'user:list',
    UPDATE: 'user:update',
    DELETE: 'user:delete',
    CREATE: 'user:create',
  },
  SETTINGS: {
    GET: 'settings:get',
    UPDATE: 'settings:update',
    SYSTEM_GET: 'settings:system-get',
    SYSTEM_UPDATE: 'settings:system-update',
  },
  API_KEY: {
    GET: 'api-key:get',
    SET: 'api-key:set',
    DELETE: 'api-key:delete',
    VALIDATE: 'api-key:validate',
  },
  ADMIN: {
    STATS: 'admin:stats',
    LOGS: 'admin:logs',
  },
  SYSTEM: {
    GET_VERSION: 'system:get-version',
    OPEN_EXTERNAL: 'system:open-external',
    CLIPBOARD_COPY: 'system:clipboard-copy',
    EXPORT_SESSION: 'system:export-session',
    SHOW_SAVE_DIALOG: 'system:show-save-dialog',
    AUTO_START_GET: 'system:auto-start-get',
    AUTO_START_SET: 'system:auto-start-set',
  },
} as const;

// Recording state interface
export interface RecordingState {
  isRecording: boolean;
  duration: number; // milliseconds
  level: number; // 0-100
}

// Transcription types
export type STTProvider = 'groq' | 'elevenlabs';

export interface TranscriptionRequest {
  audioPath: string;
  language?: string;
  provider?: STTProvider;
  model?: string;
  diarize?: boolean;
  numSpeakers?: number;
}

export interface TranscriptionSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
  duration?: number;
  model?: string;
  provider?: string;
}

// Refinement types
export interface RefinementRequest {
  text: string;
  formatType?: string;
  language?: string;
  refineModel?: string;
  classifierModel?: string;
}

export interface RefinementResult {
  text: string;
  formalText?: string;
  summary?: string;
  modelsUsed?: {
    refine: string;
    classifier?: string;
  };
}

// Session filter
export interface SessionFilterIPC {
  userId: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// STT Provider and Model definitions
export interface STTModelInfo {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
}

export interface STTProviderInfo {
  name: string;
  models: readonly STTModelInfo[];
  description: string;
}

export interface LLMModelInfo {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
}

// API Key types
export type ApiKeyType = 'groq' | 'elevenlabs';
