/**
 * IPC Channel definitions and related types
 */

// Workflow mode determines post-transcription processing
export type WorkflowMode = 'normal' | 'translate' | 'minutes';

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
    CHUNK_PROGRESS: 'transcription:chunk-progress',
  },
  REFINEMENT: {
    START: 'refinement:start',
    COMPLETE: 'refinement:complete',
    ERROR: 'refinement:error',
    REFINEMENT_PROGRESS: 'refinement:chunk-progress',
  },
  TRANSLATION: {
    START: 'translation:start',
    COMPLETE: 'translation:complete',
    ERROR: 'translation:error',
    PROGRESS: 'translation:chunk-progress',
  },
  MINUTES: {
    START: 'minutes:start',
    COMPLETE: 'minutes:complete',
    ERROR: 'minutes:error',
    PROGRESS: 'minutes:chunk-progress',
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
  MODELS: {
    FETCH: 'models:fetch',
  },
} as const;

// Recording state interface
export interface RecordingState {
  isRecording: boolean;
  duration: number; // milliseconds
  level: number; // 0-100
}

// Transcription types
export type STTProvider = 'groq' | 'elevenlabs' | 'fireworks';

export interface TranscriptionRequest {
  audioPath: string;
  language?: string;
  provider?: STTProvider;
  model?: string;
  diarize?: boolean;
  numSpeakers?: number;
  recordingDuration?: number; // Duration in seconds, used to determine chunking
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
export type LLMProvider = 'groq' | 'fireworks' | 'openai' | 'anthropic';

export interface ModelFetchRequest {
  provider: LLMProvider;
}

export interface ModelFetchResult {
  models: LLMModelInfo[];
  fromCache: boolean;
}

export interface RefinementRequest {
  text: string;
  formatType?: string;
  language?: string;
  refineModel?: string;
  classifierModel?: string;
  llmProvider?: LLMProvider;
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
export type ApiKeyType = 'groq' | 'elevenlabs' | 'fireworks' | 'openai' | 'anthropic';

// Processing progress types for long recording support
export type ProcessingStage = 'chunking' | 'transcribing' | 'merging' | 'refining' | 'summarizing';

export interface ProcessingProgress {
  stage: ProcessingStage;
  stageLabel: string;        // Human-readable stage name (Korean)
  currentChunk: number;      // Current chunk being processed (1-based)
  totalChunks: number;       // Total number of chunks
  overallProgress: number;   // 0-100 percentage
  estimatedRemainingMs?: number;  // Estimated remaining time in ms
  chunkResults?: number;     // Number of chunks completed successfully
  chunkErrors?: number;      // Number of chunks that failed
}

// Translation types
export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  model?: string;
  llmProvider?: LLMProvider;
}

export interface TranslationResult {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  modelsUsed?: string;
}

// Minutes (meeting notes) types
export interface MinutesRequest {
  text: string;
  language?: string;
  model?: string;
  llmProvider?: LLMProvider;
}

export interface MinutesResult {
  text: string;
  summary?: string;
  modelsUsed?: string;
}
