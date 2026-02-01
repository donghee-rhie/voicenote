import fs from 'fs';
import path from 'path';
import type { TranscriptionResult, TranscriptionSegment } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

export type ElevenLabsModel = 'scribe_v1' | 'scribe_v2';

export interface ElevenLabsSTTOptions {
  language?: string;
  model?: ElevenLabsModel;
  diarize?: boolean;
  numSpeakers?: number;
  tagAudioEvents?: boolean;
}

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
}

interface ElevenLabsResponse {
  text: string;
  language_code?: string;
  language_probability?: number;
  words?: ElevenLabsWord[];
}

/**
 * Get ElevenLabs API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('elevenlabs');
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not set. Please configure it in Settings.');
  }
  return apiKey;
}

/**
 * Convert ElevenLabs words to transcription segments
 * Groups words by speaker if diarization is enabled
 */
function wordsToSegments(words: ElevenLabsWord[]): TranscriptionSegment[] {
  if (!words || words.length === 0) return [];

  const segments: TranscriptionSegment[] = [];
  let currentSegment: TranscriptionSegment | null = null;
  let currentSpeaker: string | undefined = undefined;

  for (const word of words) {
    // Skip spacing and audio events for text, but use them for segment boundaries
    if (word.type === 'spacing') continue;
    if (word.type === 'audio_event') {
      // Audio events can be used to mark pauses/boundaries
      if (currentSegment) {
        segments.push(currentSegment);
        currentSegment = null;
      }
      continue;
    }

    const speakerChanged = word.speaker_id !== currentSpeaker;
    
    if (!currentSegment || speakerChanged) {
      // Save previous segment
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      // Start new segment
      currentSegment = {
        start: word.start,
        end: word.end,
        text: word.text,
        speaker: word.speaker_id,
      };
      currentSpeaker = word.speaker_id;
    } else {
      // Append to current segment
      currentSegment.text += ' ' + word.text;
      currentSegment.end = word.end;
    }
  }

  // Don't forget the last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.flac': 'audio/flac',
  };
  return mimeTypes[ext] || 'audio/webm';
}

/**
 * Transcribe audio using ElevenLabs Scribe API
 */
export async function transcribeWithElevenLabs(
  audioPath: string,
  options: ElevenLabsSTTOptions = {}
): Promise<TranscriptionResult> {
  try {
    const apiKey = getApiKey();

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Read file as buffer
    const fileBuffer = fs.readFileSync(audioPath);
    const fileName = path.basename(audioPath);
    const mimeType = getMimeType(audioPath);

    // Create form data using Node.js built-in FormData (available in Node 18+)
    const formData = new FormData();
    
    // Create Blob from buffer
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', fileBlob, fileName);
    formData.append('model_id', options.model || 'scribe_v1');
    
    if (options.language) {
      // ElevenLabs uses language codes like 'ko', 'en', 'ja'
      const langCode = options.language.split('-')[0].toLowerCase();
      formData.append('language_code', langCode);
    }

    // Diarization options (scribe_v2 only)
    if (options.model === 'scribe_v2' && options.diarize) {
      formData.append('diarize', 'true');
      if (options.numSpeakers) {
        formData.append('num_speakers', String(options.numSpeakers));
      }
    }

    // Tag audio events (scribe_v2 only)
    if (options.model === 'scribe_v2' && options.tagAudioEvents) {
      formData.append('tag_audio_events', 'true');
    }

    console.log(`[ElevenLabs STT] Sending file: ${fileName}, size: ${fileBuffer.length}, type: ${mimeType}, model: ${options.model}, diarize: ${options.diarize}`);

    // Make API request
    const response = await fetch(ELEVENLABS_API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });

    console.log('[ElevenLabs STT] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ElevenLabs STT] API Error:', response.status, errorText);
      let errorMessage = `ElevenLabs API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorJson.detail || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as ElevenLabsResponse;
    console.log('[ElevenLabs STT] Transcription result:', data.text?.substring(0, 100), '...');
    console.log('[ElevenLabs STT] Words count:', data.words?.length || 0);
    if (data.words && data.words.length > 0) {
      const speakerIds = new Set(data.words.filter(w => w.speaker_id).map(w => w.speaker_id));
      console.log('[ElevenLabs STT] Speaker IDs found:', Array.from(speakerIds));
    }

    // Build result
    const result: TranscriptionResult = {
      text: data.text,
      language: data.language_code,
      provider: 'elevenlabs',
      model: options.model || 'scribe_v1',
    };

    // Convert words to segments if available
    if (data.words && data.words.length > 0) {
      result.segments = wordsToSegments(data.words);
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ElevenLabs STT failed: ${error.message}`);
    }
    throw new Error('ElevenLabs STT failed: Unknown error');
  }
}

/**
 * Check if ElevenLabs API key is configured
 */
export function isElevenLabsConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available ElevenLabs STT models
 */
export const ELEVENLABS_MODELS = [
  {
    id: 'scribe_v1',
    name: 'Scribe v1',
    description: '기본 음성 인식 모델',
    recommended: false,
  },
  {
    id: 'scribe_v2',
    name: 'Scribe v2',
    description: '화자 분리 및 오디오 이벤트 태깅 지원',
    recommended: true,
  },
] as const;
