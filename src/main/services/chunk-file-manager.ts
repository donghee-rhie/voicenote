import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const RECORDING_TEMP_DIR = 'temp/recordings';
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface StreamingChunkInfo {
  sessionId: string;
  chunkIndex: number;
  filePath: string;
  timestamp: number;
  size: number;
}

export interface RecoveryInfo {
  sessionId: string;
  chunkFiles: string[];
  totalSize: number;
  lastModified: number;
  chunkCount: number;
}

/**
 * Manages temporary chunk files for streaming recording and crash recovery.
 */
export class ChunkFileManager {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(app.getPath('userData'), RECORDING_TEMP_DIR);
    this.ensureDir(this.baseDir);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get or create a session directory for streaming chunks
   */
  getSessionDir(sessionId: string): string {
    const sessionDir = path.join(this.baseDir, sessionId);
    this.ensureDir(sessionDir);
    return sessionDir;
  }

  /**
   * Save a streaming chunk to disk
   */
  saveChunk(sessionId: string, chunkIndex: number, data: Buffer): StreamingChunkInfo {
    const sessionDir = this.getSessionDir(sessionId);
    const filename = `chunk-${String(chunkIndex).padStart(4, '0')}.webm`;
    const filePath = path.join(sessionDir, filename);

    fs.writeFileSync(filePath, data);

    return {
      sessionId,
      chunkIndex,
      filePath,
      timestamp: Date.now(),
      size: data.length,
    };
  }

  /**
   * Read all chunks for a session and merge them into a single buffer
   */
  mergeSessionChunks(sessionId: string): Buffer | null {
    const sessionDir = this.getSessionDir(sessionId);

    if (!fs.existsSync(sessionDir)) {
      return null;
    }

    const files = fs.readdirSync(sessionDir)
      .filter(f => f.startsWith('chunk-') && f.endsWith('.webm'))
      .sort();

    if (files.length === 0) {
      return null;
    }

    const buffers = files.map(f => fs.readFileSync(path.join(sessionDir, f)));
    return Buffer.concat(buffers);
  }

  /**
   * Clean up chunks for a completed session
   */
  cleanupSession(sessionId: string): void {
    const sessionDir = path.join(this.baseDir, sessionId);

    if (!fs.existsSync(sessionDir)) return;

    try {
      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        fs.unlinkSync(path.join(sessionDir, file));
      }
      fs.rmdirSync(sessionDir);
      console.log(`[ChunkFileManager] Cleaned up session: ${sessionId}`);
    } catch (err) {
      console.error(`[ChunkFileManager] Cleanup failed for session ${sessionId}:`, err);
    }
  }

  /**
   * Detect incomplete recording sessions (for crash recovery)
   */
  detectIncompleteRecordings(): RecoveryInfo[] {
    if (!fs.existsSync(this.baseDir)) return [];

    const recoverable: RecoveryInfo[] = [];
    const sessions = fs.readdirSync(this.baseDir);

    for (const sessionId of sessions) {
      const sessionDir = path.join(this.baseDir, sessionId);
      const stat = fs.statSync(sessionDir);

      if (!stat.isDirectory()) continue;

      const chunkFiles = fs.readdirSync(sessionDir)
        .filter(f => f.startsWith('chunk-') && f.endsWith('.webm'))
        .sort()
        .map(f => path.join(sessionDir, f));

      if (chunkFiles.length > 0) {
        const totalSize = chunkFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0);
        const lastModified = Math.max(
          ...chunkFiles.map(f => fs.statSync(f).mtimeMs)
        );

        recoverable.push({
          sessionId,
          chunkFiles,
          totalSize,
          lastModified,
          chunkCount: chunkFiles.length,
        });
      }
    }

    return recoverable;
  }

  /**
   * Clean up stale recordings older than 24 hours
   */
  cleanupStaleRecordings(): number {
    const incomplete = this.detectIncompleteRecordings();
    let cleaned = 0;
    const now = Date.now();

    for (const info of incomplete) {
      if (now - info.lastModified > STALE_THRESHOLD_MS) {
        this.cleanupSession(info.sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check available disk space (approximate)
   */
  getAvailableSpace(): { available: boolean; message?: string } {
    try {
      // Simple check: try writing a small temp file
      const testPath = path.join(this.baseDir, '.space-check');
      fs.writeFileSync(testPath, 'test');
      fs.unlinkSync(testPath);
      return { available: true };
    } catch {
      return { available: false, message: '디스크 공간이 부족합니다' };
    }
  }
}
