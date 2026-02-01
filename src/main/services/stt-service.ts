import OpenAI from 'openai';
import fs from 'fs';
import type { TranscriptionResult } from '../../common/types/ipc';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client with API key
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
  prompt?: string;
  temperature?: number;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

/**
 * Transcribe audio file using OpenAI Whisper API
 */
export async function transcribeAudio(
  audioPath: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  try {
    const client = getOpenAIClient();

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Create a read stream for the audio file
    const audioFile = fs.createReadStream(audioPath);

    // Call OpenAI Whisper API
    const response = await client.audio.transcriptions.create({
      file: audioFile,
      model: options.model || 'whisper-1',
      language: options.language,
      prompt: options.prompt,
      temperature: options.temperature,
      response_format: options.response_format || 'verbose_json',
    });

    // Handle different response formats
    if (typeof response === 'string') {
      return { text: response };
    }

    // For verbose_json format, extract segments if available
    const result: TranscriptionResult = {
      text: response.text,
    };

    // Type assertion for verbose response
    const verboseResponse = response as any;
    if (verboseResponse.segments) {
      result.segments = verboseResponse.segments.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
    throw new Error('Transcription failed: Unknown error');
  }
}

/**
 * Set API key at runtime (useful for settings updates)
 */
export function setOpenAIApiKey(apiKey: string): void {
  openaiClient = new OpenAI({ apiKey });
}
