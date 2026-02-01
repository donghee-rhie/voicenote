import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { transcribeAudio } from '../services/stt-service';
import { transcribeWithGroq, isGroqConfigured } from '../services/groq-stt-service';
import { transcribeWithElevenLabs, isElevenLabsConfigured } from '../services/elevenlabs-stt-service';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { TranscriptionRequest, TranscriptionResult, STTProvider } from '../../common/types/ipc';

let recordingState = {
  isRecording: false,
  startTime: 0,
};

/**
 * Register transcription and audio-related IPC handlers
 */
export function registerTranscriptionHandlers(mainWindow: BrowserWindow) {
  // Start transcription
  ipcMain.handle(IPC_CHANNELS.TRANSCRIPTION.START, async (_event, request: TranscriptionRequest) => {
    try {
      const { audioPath, language, provider, model, diarize, numSpeakers } = request;

      if (!audioPath) {
        return {
          success: false,
          error: 'Audio path is required',
        };
      }

      // Check if file exists
      if (!fs.existsSync(audioPath)) {
        return {
          success: false,
          error: 'Audio file not found',
        };
      }

      // Emit progress event
      mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION.PROGRESS, {
        status: 'processing',
        progress: 0,
      });

      let result: TranscriptionResult;

      // Route to appropriate provider
      const selectedProvider = provider || 'groq'; // Default to Groq

      switch (selectedProvider) {
        case 'groq':
          if (!isGroqConfigured()) {
            return {
              success: false,
              error: 'Groq API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.',
            };
          }
          result = await transcribeWithGroq(audioPath, {
            language,
            model: (model as 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en') || 'whisper-large-v3-turbo',
            response_format: 'verbose_json',
          });
          break;

        case 'elevenlabs':
          if (!isElevenLabsConfigured()) {
            return {
              success: false,
              error: 'ElevenLabs API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.',
            };
          }
          result = await transcribeWithElevenLabs(audioPath, {
            language,
            model: (model as 'scribe_v1' | 'scribe_v2') || 'scribe_v1',
            diarize,
            numSpeakers,
          });
          break;

        default:
          return {
            success: false,
            error: `Provider '${selectedProvider}' is not supported`,
          };
      }

      console.log('[Transcription] Complete, text:', result.text?.substring(0, 100));

      // Emit complete event
      mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION.COMPLETE, result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Transcription error:', error);

      // Emit error event
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION.ERROR, {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  // Start recording
  ipcMain.handle(IPC_CHANNELS.AUDIO.START_RECORDING, async () => {
    try {
      recordingState.isRecording = true;
      recordingState.startTime = Date.now();

      // Send recording state update
      mainWindow.webContents.send(IPC_CHANNELS.AUDIO.RECORDING_STATE, {
        isRecording: true,
        duration: 0,
        level: 0,
      });

      return {
        success: true,
        data: { isRecording: true },
      };
    } catch (error) {
      console.error('Start recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      };
    }
  });

  // Stop recording
  ipcMain.handle(IPC_CHANNELS.AUDIO.STOP_RECORDING, async () => {
    try {
      const duration = recordingState.isRecording
        ? Date.now() - recordingState.startTime
        : 0;

      recordingState.isRecording = false;
      recordingState.startTime = 0;

      // Send recording state update
      mainWindow.webContents.send(IPC_CHANNELS.AUDIO.RECORDING_STATE, {
        isRecording: false,
        duration,
        level: 0,
      });

      return {
        success: true,
        data: { isRecording: false, duration },
      };
    } catch (error) {
      console.error('Stop recording error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop recording',
      };
    }
  });

  // Get audio file as base64 for playback
  ipcMain.handle(IPC_CHANNELS.AUDIO.GET_FILE, async (_event, audioPath: string) => {
    try {
      if (!audioPath) {
        return {
          success: false,
          error: 'Audio path is required',
        };
      }

      if (!fs.existsSync(audioPath)) {
        return {
          success: false,
          error: 'Audio file not found',
        };
      }

      // Read file and convert to base64
      const buffer = fs.readFileSync(audioPath);
      const base64 = buffer.toString('base64');
      
      // Determine MIME type from extension
      const ext = path.extname(audioPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.webm': 'audio/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.mp4': 'audio/mp4',
      };
      const mimeType = mimeTypes[ext] || 'audio/webm';

      return {
        success: true,
        data: {
          base64,
          mimeType,
        },
      };
    } catch (error) {
      console.error('Get audio file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audio file',
      };
    }
  });

  // Save audio blob
  ipcMain.handle(IPC_CHANNELS.AUDIO.SAVE_BLOB, async (_event, audioData: ArrayBuffer, filename?: string) => {
    try {
      if (!audioData) {
        return {
          success: false,
          error: 'Audio data is required',
        };
      }

      // Create temp directory if it doesn't exist
      const tempDir = path.join(app.getPath('userData'), 'temp', 'audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate filename if not provided
      const audioFilename = filename || `recording-${Date.now()}.webm`;
      const audioPath = path.join(tempDir, audioFilename);

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(audioData);

      // Write file
      fs.writeFileSync(audioPath, buffer);

      return {
        success: true,
        data: { path: audioPath },
      };
    } catch (error) {
      console.error('Save audio blob error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save audio',
      };
    }
  });
}
