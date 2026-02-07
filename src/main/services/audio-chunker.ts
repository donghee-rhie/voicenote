import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface ChunkConfig {
  chunkDurationSec: number;  // Default 420 (7 minutes)
  overlapSec: number;        // Default 3
}

export interface AudioChunk {
  index: number;
  startTime: number;   // seconds
  endTime: number;     // seconds
  buffer: Buffer;
  filePath: string;
}

export interface ChunkResult {
  chunks: AudioChunk[];
  totalDuration: number;
  totalChunks: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  chunkDurationSec: 420,  // 7 minutes
  overlapSec: 3,
};

export class AudioChunker {
  private config: ChunkConfig;

  constructor(config: Partial<ChunkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate chunk boundaries for a given audio duration.
   * Each chunk is at most chunkDurationSec long, with overlapSec overlap
   * between consecutive chunks to prevent sentence breaks at boundaries.
   */
  calculateChunkBoundaries(totalDurationSec: number): Array<{ start: number; end: number }> {
    const { chunkDurationSec, overlapSec } = this.config;
    const boundaries: Array<{ start: number; end: number }> = [];

    if (totalDurationSec <= chunkDurationSec) {
      // No splitting needed
      return [{ start: 0, end: totalDurationSec }];
    }

    const step = chunkDurationSec - overlapSec;
    let start = 0;

    while (start < totalDurationSec) {
      const end = Math.min(start + chunkDurationSec, totalDurationSec);
      boundaries.push({ start, end });

      if (end >= totalDurationSec) break;
      start += step;
    }

    return boundaries;
  }

  /**
   * Check if audio needs chunking based on duration.
   */
  needsChunking(totalDurationSec: number): boolean {
    return totalDurationSec > this.config.chunkDurationSec;
  }

  /**
   * Split an audio buffer into chunks based on duration.
   * Uses proportional byte offset splitting (simple but effective for WebM/Opus).
   * Each chunk file gets written to disk for the STT API to consume.
   *
   * For WebM files, the container header (typically in the first few KB) is
   * prepended to every chunk so that each one is a structurally valid file
   * that decoders and STT APIs can open independently.
   */
  async splitAudioFile(audioPath: string, totalDurationSec: number): Promise<ChunkResult> {
    const boundaries = this.calculateChunkBoundaries(totalDurationSec);

    if (boundaries.length <= 1) {
      // No splitting needed, return the original file as a single chunk
      const buffer = fs.readFileSync(audioPath);
      return {
        chunks: [{
          index: 0,
          startTime: 0,
          endTime: totalDurationSec,
          buffer,
          filePath: audioPath,
        }],
        totalDuration: totalDurationSec,
        totalChunks: 1,
      };
    }

    const fullBuffer = fs.readFileSync(audioPath);
    const fileSize = fullBuffer.length;

    // Create temp directory for chunks
    const chunkDir = path.join(app.getPath('userData'), 'temp', 'chunks', `session-${Date.now()}`);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunks: AudioChunk[] = [];

    for (let i = 0; i < boundaries.length; i++) {
      const { start, end } = boundaries[i];

      // Calculate byte offsets proportionally
      const startByte = Math.floor((start / totalDurationSec) * fileSize);
      const endByte = Math.floor((end / totalDurationSec) * fileSize);

      // For the first chunk, include from the beginning (to preserve WebM header).
      // For subsequent chunks, prepend the WebM header (first 4 KB) so that
      // the resulting file is a structurally valid WebM that decoders can open.
      let chunkBuffer: Buffer;

      if (i === 0) {
        chunkBuffer = fullBuffer.subarray(0, endByte);
      } else {
        const headerSize = Math.min(4096, startByte);
        const header = fullBuffer.subarray(0, headerSize);
        const data = fullBuffer.subarray(startByte, endByte);
        chunkBuffer = Buffer.concat([header, data]);
      }

      const chunkPath = path.join(chunkDir, `chunk-${String(i).padStart(3, '0')}.webm`);
      fs.writeFileSync(chunkPath, chunkBuffer);

      chunks.push({
        index: i,
        startTime: start,
        endTime: end,
        buffer: chunkBuffer,
        filePath: chunkPath,
      });
    }

    return {
      chunks,
      totalDuration: totalDurationSec,
      totalChunks: chunks.length,
    };
  }

  /**
   * Clean up chunk files after transcription is complete.
   * Only removes files whose paths contain 'chunks' as a safety guard.
   */
  async cleanupChunks(chunks: AudioChunk[]): Promise<void> {
    for (const chunk of chunks) {
      try {
        if (fs.existsSync(chunk.filePath) && chunk.filePath.includes('chunks')) {
          fs.unlinkSync(chunk.filePath);
        }
      } catch (err) {
        console.error(`[AudioChunker] Failed to clean up chunk: ${chunk.filePath}`, err);
      }
    }

    // Try to remove the chunk directory
    if (chunks.length > 0) {
      const chunkDir = path.dirname(chunks[0].filePath);
      try {
        if (fs.existsSync(chunkDir) && chunkDir.includes('chunks')) {
          fs.rmdirSync(chunkDir);
        }
      } catch {
        // Directory might not be empty, ignore
      }
    }
  }
}
