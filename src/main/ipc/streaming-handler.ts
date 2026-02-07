import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { ChunkFileManager } from '../services/chunk-file-manager';

const chunkFileManager = new ChunkFileManager();

/**
 * Register streaming recording and crash recovery IPC handlers
 */
export function registerStreamingHandlers(): void {
  // Save a streaming chunk during recording
  ipcMain.handle('audio:save-streaming-chunk', async (_event, args: { sessionId: string; chunkIndex: number; data: ArrayBuffer }) => {
    try {
      const { sessionId, chunkIndex, data } = args;

      if (!sessionId || data == null) {
        return { success: false, error: 'sessionId and data are required' };
      }

      const buffer = Buffer.from(data);
      const info = chunkFileManager.saveChunk(sessionId, chunkIndex, buffer);

      return { success: true, data: info };
    } catch (error) {
      console.error('[Streaming] Save chunk error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save streaming chunk',
      };
    }
  });

  // Detect and list incomplete recordings for recovery
  // When called without sessionId: returns list of recoverable sessions
  // When called with sessionId: merges chunks and returns audio path
  ipcMain.handle('audio:recover-chunks', async (_event, sessionId?: string) => {
    try {
      if (!sessionId) {
        // List all incomplete recordings
        const incomplete = chunkFileManager.detectIncompleteRecordings();
        return { success: true, data: incomplete };
      }

      // Merge chunks for a specific session
      const mergedBuffer = chunkFileManager.mergeSessionChunks(sessionId);
      if (!mergedBuffer) {
        return { success: false, error: 'No chunks found for this session' };
      }

      // Save merged audio to temp directory
      const tempDir = path.join(app.getPath('userData'), 'temp', 'audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const audioPath = path.join(tempDir, `recovered-${sessionId}-${Date.now()}.webm`);
      fs.writeFileSync(audioPath, mergedBuffer);

      // Clean up chunk files after successful merge
      chunkFileManager.cleanupSession(sessionId);

      return { success: true, data: { audioPath } };
    } catch (error) {
      console.error('[Streaming] Recover chunks error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recover chunks',
      };
    }
  });

  // Clean up chunks for a session
  ipcMain.handle('audio:cleanup-chunks', async (_event, sessionId: string) => {
    try {
      if (!sessionId) {
        return { success: false, error: 'sessionId is required' };
      }

      chunkFileManager.cleanupSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error('[Streaming] Cleanup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup chunks',
      };
    }
  });

  // Clean up stale recordings on startup
  try {
    const cleaned = chunkFileManager.cleanupStaleRecordings();
    if (cleaned > 0) {
      console.log(`[Streaming] Cleaned up ${cleaned} stale recording sessions`);
    }
  } catch (err) {
    console.error('[Streaming] Stale cleanup error:', err);
  }
}
