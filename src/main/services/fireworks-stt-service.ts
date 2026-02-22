import fs from 'fs';
import path from 'path';
import https from 'https';
import FormData from 'form-data';
import type { TranscriptionResult, TranscriptionSegment } from '../../common/types/ipc';
import { getApiKeyWithFallback } from './api-key-service';

export type FireworksWhisperModel = 'whisper-v3' | 'whisper-v3-turbo';

export interface FireworksSTTOptions {
  language?: string;
  model?: FireworksWhisperModel;
  response_format?: string;
}

interface FireworksSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface FireworksResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: FireworksSegment[];
}

/**
 * Get Fireworks API endpoint based on model
 */
function getApiEndpoint(model: FireworksWhisperModel): string {
  if (model === 'whisper-v3-turbo') {
    return 'https://audio-turbo.api.fireworks.ai/v1/audio/transcriptions';
  }
  return 'https://audio-prod.api.fireworks.ai/v1/audio/transcriptions';
}

/**
 * Get Fireworks API key from store or environment
 */
function getApiKey(): string {
  const apiKey = getApiKeyWithFallback('fireworks');
  if (!apiKey) {
    throw new Error('Fireworks API key is not set. Please configure it in Settings.');
  }
  return apiKey;
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
 * Send multipart form data via https and return parsed JSON response.
 * Uses form-data package with fs.createReadStream for reliable large file streaming.
 */
function postFormData(apiKey: string, endpoint: string, formData: FormData): Promise<FireworksResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const reqOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': apiKey, // NO "Bearer" prefix for Fireworks audio endpoints
        ...formData.getHeaders(),
      },
    };

    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        console.log('[Fireworks STT] Response status:', res.statusCode);

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          console.error('[Fireworks STT] API Error:', res.statusCode, body);
          let errorMessage = `Fireworks API error: ${res.statusCode}`;
          try {
            const errorJson = JSON.parse(body);
            errorMessage = errorJson.detail?.message || errorJson.detail || errorJson.message || errorMessage;
          } catch {
            errorMessage = body || errorMessage;
          }
          return reject(new Error(errorMessage));
        }

        try {
          const data = JSON.parse(body) as FireworksResponse;
          resolve(data);
        } catch (parseErr) {
          reject(new Error(`Failed to parse Fireworks response: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network request failed: ${err.message}`));
    });

    // Stream the form data (including large audio file) to the request
    formData.pipe(req);
  });
}

/**
 * Transcribe audio using Fireworks Whisper API
 * Uses streaming upload via form-data package for reliable large file handling.
 */
export async function transcribeWithFireworks(
  audioPath: string,
  options: FireworksSTTOptions = {}
): Promise<TranscriptionResult> {
  try {
    const apiKey = getApiKey();
    const model = options.model || 'whisper-v3-turbo';
    const endpoint = getApiEndpoint(model);

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const fileName = path.basename(audioPath);
    const mimeType = getMimeType(audioPath);
    const fileStat = fs.statSync(audioPath);

    // Build multipart form using form-data package with streaming
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath), {
      filename: fileName,
      contentType: mimeType,
      knownLength: fileStat.size,
    });
    formData.append('model', model);
    formData.append('response_format', 'verbose_json'); // Request segments

    if (options.language) {
      formData.append('language', options.language);
    }

    console.log(`[Fireworks STT] Streaming file: ${fileName}, size: ${fileStat.size} bytes (${(fileStat.size / 1024 / 1024).toFixed(1)}MB), type: ${mimeType}, model: ${model}, endpoint: ${endpoint}`);

    const data = await postFormData(apiKey, endpoint, formData);

    console.log('[Fireworks STT] Transcription result:', data.text?.substring(0, 100), '...');
    console.log('[Fireworks STT] Segments count:', data.segments?.length || 0);
    console.log('[Fireworks STT] Language:', data.language, 'Duration:', data.duration);

    // Build result
    const result: TranscriptionResult = {
      text: data.text,
      language: data.language,
      duration: data.duration,
      provider: 'fireworks',
      model: model,
    };

    // Map segments if available
    if (data.segments && data.segments.length > 0) {
      result.segments = data.segments.map((seg): TranscriptionSegment => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Fireworks STT failed: ${error.message}`);
    }
    throw new Error('Fireworks STT failed: Unknown error');
  }
}

/**
 * Check if Fireworks API key is configured
 */
export function isFireworksConfigured(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Available Fireworks Whisper models
 */
export const FIREWORKS_WHISPER_MODELS = [
  {
    id: 'whisper-v3-turbo',
    name: 'Whisper v3 Turbo',
    description: '빠르고 정확한 음성 인식 (권장)',
    recommended: true,
  },
  {
    id: 'whisper-v3',
    name: 'Whisper v3',
    description: '최고 품질의 음성 인식',
    recommended: false,
  },
] as const;
