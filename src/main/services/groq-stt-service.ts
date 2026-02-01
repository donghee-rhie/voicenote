import Groq from 'groq-sdk';
import fs from 'fs';
import type { TranscriptionResult, TranscriptionSegment } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';

let groqClient: Groq | null = null;

export type GroqWhisperModel = 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en';

export interface GroqSTTOptions {
  language?: string;
  model?: GroqWhisperModel;
  prompt?: string;
  temperature?: number;
  response_format?: 'json' | 'text' | 'verbose_json';
}

interface GroqVerboseSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

interface GroqVerboseResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments?: GroqVerboseSegment[];
}

/**
 * Get Groq API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('groq');
  if (!apiKey) {
    throw new Error('Groq API key is not set. Please configure it in Settings.');
  }
  return apiKey;
}

/**
 * Initialize or get Groq client
 */
function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = getApiKey();
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Reset client (useful when API key changes)
 */
export function resetGroqClient(): void {
  groqClient = null;
}

/**
 * Convert Groq verbose segments to transcription segments
 */
function convertSegments(segments: GroqVerboseSegment[]): TranscriptionSegment[] {
  return segments.map((seg) => ({
    id: seg.id,
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }));
}

/**
 * Transcribe audio using Groq Whisper API
 */
export async function transcribeWithGroq(
  audioPath: string,
  options: GroqSTTOptions = {}
): Promise<TranscriptionResult> {
  try {
    const client = getGroqClient();

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Create a read stream for the audio file
    const audioFile = fs.createReadStream(audioPath);

    // Default to verbose_json for segment information
    const responseFormat = options.response_format || 'verbose_json';

    console.log('[Groq STT] Sending transcription request for:', audioPath);
    
    // Call Groq Whisper API
    const response = await client.audio.transcriptions.create({
      file: audioFile,
      model: options.model || 'whisper-large-v3-turbo',
      language: options.language ? options.language.split('-')[0].toLowerCase() : undefined,
      prompt: options.prompt,
      temperature: options.temperature,
      response_format: responseFormat,
    });

    console.log('[Groq STT] Got response, type:', typeof response);

    // Handle different response formats
    if (typeof response === 'string') {
      console.log('[Groq STT] String response:', (response as string).substring(0, 100));
      return {
        text: response,
        provider: 'groq',
        model: options.model || 'whisper-large-v3-turbo',
      };
    }

    // For verbose_json format
    const verboseResponse = response as unknown as GroqVerboseResponse;
    console.log('[Groq STT] Verbose response text:', verboseResponse.text?.substring(0, 100));
    
    const result: TranscriptionResult = {
      text: verboseResponse.text,
      language: verboseResponse.language,
      duration: verboseResponse.duration,
      provider: 'groq',
      model: options.model || 'whisper-large-v3-turbo',
    };

    // Extract segments if available
    if (verboseResponse.segments && verboseResponse.segments.length > 0) {
      result.segments = convertSegments(verboseResponse.segments);
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('401')) {
        throw new Error('Groq API 인증 실패. API 키를 확인해주세요.');
      }
      if (error.message.includes('429')) {
        throw new Error('Groq API 요청 한도 초과. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(`Groq STT failed: ${error.message}`);
    }
    throw new Error('Groq STT failed: Unknown error');
  }
}

/**
 * Check if Groq API key is configured
 */
export function isGroqConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available Groq Whisper models
 */
export const GROQ_WHISPER_MODELS = [
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    description: '빠르고 정확한 다국어 음성 인식 (권장)',
    recommended: true,
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3',
    description: '최고 품질의 다국어 음성 인식',
    recommended: false,
  },
  {
    id: 'distil-whisper-large-v3-en',
    name: 'Distil Whisper Large v3 (영어)',
    description: '영어 전용 최적화 모델',
    recommended: false,
  },
] as const;
