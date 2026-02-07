import { ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { transcribeAudio } from '../services/stt-service';
import { transcribeWithGroq, isGroqConfigured } from '../services/groq-stt-service';
import { transcribeWithElevenLabs, isElevenLabsConfigured } from '../services/elevenlabs-stt-service';
import { AudioChunker } from '../services/audio-chunker';
import { TranscriptionMerger, ChunkTranscription } from '../services/transcription-merger';
import { withRetry } from '../services/retry-handler';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { TranscriptionRequest, TranscriptionResult, STTProvider, ProcessingProgress } from '../../common/types/ipc';

let recordingState = {
  isRecording: false,
  startTime: 0,
};

// Audio chunker with 7-min chunks, 3s overlap
const audioChunker = new AudioChunker();
const transcriptionMerger = new TranscriptionMerger(3);

/**
 * Send processing progress to renderer
 */
function sendProgress(mainWindow: BrowserWindow, progress: ProcessingProgress) {
  mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION.CHUNK_PROGRESS, progress);
}

/**
 * Transcribe a single audio file with the selected provider (with retry)
 */
async function transcribeSingle(
  audioPath: string,
  provider: STTProvider,
  options: { language?: string; model?: string; diarize?: boolean; numSpeakers?: number }
): Promise<TranscriptionResult> {
  const { language, model, diarize, numSpeakers } = options;

  switch (provider) {
    case 'groq':
      return transcribeWithGroq(audioPath, {
        language,
        model: (model as 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en') || 'whisper-large-v3-turbo',
        response_format: 'verbose_json',
      });

    case 'elevenlabs':
      return transcribeWithElevenLabs(audioPath, {
        language,
        model: (model as 'scribe_v1' | 'scribe_v2') || 'scribe_v1',
        diarize,
        numSpeakers,
      });

    default:
      throw new Error(`Provider '${provider}' is not supported`);
  }
}

/**
 * Register transcription and audio-related IPC handlers
 */
export function registerTranscriptionHandlers(mainWindow: BrowserWindow) {
  // Start transcription
  ipcMain.handle(IPC_CHANNELS.TRANSCRIPTION.START, async (_event, request: TranscriptionRequest) => {
    try {
      const { audioPath, language, provider, model, diarize, numSpeakers, recordingDuration } = request;

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

      // Route to appropriate provider
      const selectedProvider = provider || 'groq';

      // Validate provider configuration
      if (selectedProvider === 'groq' && !isGroqConfigured()) {
        return {
          success: false,
          error: 'Groq API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.',
        };
      }
      if (selectedProvider === 'elevenlabs' && !isElevenLabsConfigured()) {
        return {
          success: false,
          error: 'ElevenLabs API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.',
        };
      }

      // Emit progress event
      mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION.PROGRESS, {
        status: 'processing',
        progress: 0,
      });

      const recordingDurationSec = recordingDuration || 0;

      let result: TranscriptionResult;

      // ElevenLabs handles long files natively with better diarization - no chunking needed
      // Only Groq Whisper needs chunking due to ~25MB file size limit
      const needsChunking = recordingDurationSec > 0
        && audioChunker.needsChunking(recordingDurationSec)
        && selectedProvider !== 'elevenlabs';

      if (needsChunking) {
        console.log(`[Transcription] Long recording detected (${recordingDurationSec}s), using chunked transcription for ${selectedProvider}`);
        result = await handleChunkedTranscription(
          mainWindow,
          audioPath,
          recordingDurationSec,
          selectedProvider,
          { language, model, diarize, numSpeakers }
        );
      } else {
        // Single transcription (short recording, or ElevenLabs which handles long files natively)
        const isLongElevenLabs = selectedProvider === 'elevenlabs' && recordingDurationSec > 420;
        sendProgress(mainWindow, {
          stage: 'transcribing',
          stageLabel: isLongElevenLabs
            ? `전사 중... (${Math.round(recordingDurationSec / 60)}분 분량, 화자 분리 포함)`
            : '전사 중...',
          currentChunk: 1,
          totalChunks: 1,
          overallProgress: 10,
        });

        const retryResult = await withRetry(
          () => transcribeSingle(audioPath, selectedProvider, { language, model, diarize, numSpeakers })
        );

        if (!retryResult.success || !retryResult.data) {
          throw retryResult.error || new Error('Transcription failed after retries');
        }

        result = retryResult.data;
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

/**
 * Handle chunked transcription for long recordings
 */
async function handleChunkedTranscription(
  mainWindow: BrowserWindow,
  audioPath: string,
  totalDurationSec: number,
  provider: STTProvider,
  options: { language?: string; model?: string; diarize?: boolean; numSpeakers?: number }
): Promise<TranscriptionResult> {
  // Step 1: Split audio into chunks
  sendProgress(mainWindow, {
    stage: 'chunking',
    stageLabel: '오디오 분할 중...',
    currentChunk: 0,
    totalChunks: 0,
    overallProgress: 5,
  });

  const chunkResult = await audioChunker.splitAudioFile(audioPath, totalDurationSec);
  const totalChunks = chunkResult.totalChunks;

  console.log(`[Transcription] Split into ${totalChunks} chunks`);

  // Step 2: Transcribe each chunk sequentially with retry
  const chunkTranscriptions: ChunkTranscription[] = [];
  let chunkErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < chunkResult.chunks.length; i++) {
    const chunk = chunkResult.chunks[i];

    // Calculate progress
    const chunkProgress = ((i / totalChunks) * 80) + 10; // 10-90% range
    const elapsed = Date.now() - startTime;
    const avgTimePerChunk = i > 0 ? elapsed / i : 0;
    const remainingChunks = totalChunks - i;
    const estimatedRemaining = avgTimePerChunk * remainingChunks;

    sendProgress(mainWindow, {
      stage: 'transcribing',
      stageLabel: `전사 중... (${i + 1}/${totalChunks} 청크)`,
      currentChunk: i + 1,
      totalChunks,
      overallProgress: Math.round(chunkProgress),
      estimatedRemainingMs: Math.round(estimatedRemaining),
      chunkResults: chunkTranscriptions.length,
      chunkErrors,
    });

    console.log(`[Transcription] Processing chunk ${i + 1}/${totalChunks} (${chunk.startTime}s - ${chunk.endTime}s)`);

    const retryResult = await withRetry(
      () => transcribeSingle(chunk.filePath, provider, options)
    );

    if (retryResult.success && retryResult.data) {
      chunkTranscriptions.push({
        chunkIndex: chunk.index,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        result: retryResult.data,
      });
    } else {
      chunkErrors++;
      console.error(`[Transcription] Chunk ${i + 1} failed after retries:`, retryResult.error?.message);
      // Continue with other chunks even if one fails
    }
  }

  // Step 3: Merge results
  sendProgress(mainWindow, {
    stage: 'merging',
    stageLabel: '결과 병합 중...',
    currentChunk: totalChunks,
    totalChunks,
    overallProgress: 92,
    chunkResults: chunkTranscriptions.length,
    chunkErrors,
  });

  if (chunkTranscriptions.length === 0) {
    throw new Error('모든 청크의 전사가 실패했습니다. 네트워크 연결을 확인해주세요.');
  }

  const mergedResult = transcriptionMerger.merge(chunkTranscriptions);

  // Cleanup chunk files
  try {
    await audioChunker.cleanupChunks(chunkResult.chunks);
  } catch (err) {
    console.error('[Transcription] Chunk cleanup error:', err);
  }

  sendProgress(mainWindow, {
    stage: 'merging',
    stageLabel: '전사 완료',
    currentChunk: totalChunks,
    totalChunks,
    overallProgress: 100,
    chunkResults: chunkTranscriptions.length,
    chunkErrors,
  });

  // Add metadata about chunking
  (mergedResult as any).chunked = true;
  (mergedResult as any).totalChunks = totalChunks;
  (mergedResult as any).failedChunks = chunkErrors;

  return mergedResult;
}
