import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as nodePath from 'node:path';

// ---------------------------------------------------------------------------
// Hoisted mock functions -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockReadFileSync,
  mockWriteFileSync,
  mockExistsSync,
  mockMkdirSync,
  mockUnlinkSync,
  mockRmdirSync,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockRmdirSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    unlinkSync: mockUnlinkSync,
    rmdirSync: mockRmdirSync,
  },
}));

// We do NOT mock 'path' -- vitest uses it internally and global replacement
// causes out-of-memory crashes. The real path module works correctly in tests.

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { AudioChunker } from '../audio-chunker';
import type { AudioChunk } from '../audio-chunker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a deterministic fake audio buffer of a given byte length.
 * Each byte is set to its position mod 256 so slices are verifiable.
 */
function fakeBuffer(length: number): Buffer {
  const buf = Buffer.alloc(length);
  for (let i = 0; i < length; i++) {
    buf[i] = i % 256;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioChunker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure Date.now returns a stable value for predictable path assertions
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  // =========================================================================
  // calculateChunkBoundaries
  // =========================================================================

  describe('calculateChunkBoundaries', () => {
    it('should return a single boundary for audio shorter than chunkDurationSec', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(300);

      expect(boundaries).toEqual([{ start: 0, end: 300 }]);
    });

    it('should return a single boundary for audio exactly equal to chunkDurationSec (420s)', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(420);

      expect(boundaries).toEqual([{ start: 0, end: 420 }]);
    });

    it('should return a single boundary for very short audio (1 second)', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(1);

      expect(boundaries).toEqual([{ start: 0, end: 1 }]);
    });

    it('should return a single boundary for zero-length audio', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(0);

      // 0 <= 420, so single boundary
      expect(boundaries).toEqual([{ start: 0, end: 0 }]);
    });

    it('should split 840s (2x chunk) into chunks with 3s overlap', () => {
      const chunker = new AudioChunker(); // chunkDuration=420, overlap=3
      const boundaries = chunker.calculateChunkBoundaries(840);

      // step = 420 - 3 = 417
      // chunk 0: [0, 420]
      // chunk 1: [417, 837]
      // chunk 2: [834, 840]  (since 834 < 840, another iteration)
      expect(boundaries.length).toBe(3);
      expect(boundaries[0]).toEqual({ start: 0, end: 420 });
      expect(boundaries[1]).toEqual({ start: 417, end: 837 });
      expect(boundaries[2]).toEqual({ start: 834, end: 840 });

      // Verify overlap: each consecutive pair overlaps by at least overlapSec
      for (let i = 1; i < boundaries.length; i++) {
        const overlap = boundaries[i - 1].end - boundaries[i].start;
        expect(overlap).toBeGreaterThanOrEqual(3);
      }
    });

    it('should produce correct chunk count and overlap for 3600s (1 hour)', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(3600);

      // step = 420 - 3 = 417
      // Boundaries start at 0, 417, 834, 1251, ... until end >= 3600
      expect(boundaries.length).toBeGreaterThan(1);

      // First chunk starts at 0
      expect(boundaries[0].start).toBe(0);
      expect(boundaries[0].end).toBe(420);

      // Last chunk ends at exactly totalDuration
      expect(boundaries[boundaries.length - 1].end).toBe(3600);

      // Verify all consecutive pairs have the expected overlap
      for (let i = 1; i < boundaries.length; i++) {
        const overlap = boundaries[i - 1].end - boundaries[i].start;
        expect(overlap).toBeGreaterThanOrEqual(3);
      }

      // Verify no chunk exceeds chunkDurationSec
      for (const b of boundaries) {
        expect(b.end - b.start).toBeLessThanOrEqual(420);
      }

      // Verify coverage: every second of audio is contained in at least one chunk
      for (let sec = 0; sec < 3600; sec++) {
        const covered = boundaries.some((b) => b.start <= sec && sec <= b.end);
        expect(covered).toBe(true);
      }
    });

    it('should respect custom config with shorter chunks', () => {
      const chunker = new AudioChunker({ chunkDurationSec: 60, overlapSec: 5 });
      const boundaries = chunker.calculateChunkBoundaries(150);

      // step = 60 - 5 = 55
      // chunk 0: [0, 60]
      // chunk 1: [55, 115]
      // chunk 2: [110, 150]  (min(170, 150) = 150)
      expect(boundaries).toEqual([
        { start: 0, end: 60 },
        { start: 55, end: 115 },
        { start: 110, end: 150 },
      ]);
    });

    it('should handle degenerate overlap equal to chunk duration for short audio', () => {
      // When overlap >= chunkDuration and totalDuration <= chunkDuration,
      // it should still return a single boundary safely.
      const chunker = new AudioChunker({ chunkDurationSec: 10, overlapSec: 10 });
      const safeBoundaries = chunker.calculateChunkBoundaries(10);
      expect(safeBoundaries).toEqual([{ start: 0, end: 10 }]);
    });

    it('should handle audio just slightly over chunkDurationSec', () => {
      const chunker = new AudioChunker();
      const boundaries = chunker.calculateChunkBoundaries(421);

      // step = 417
      // chunk 0: [0, 420]
      // chunk 1: [417, 421]
      expect(boundaries).toEqual([
        { start: 0, end: 420 },
        { start: 417, end: 421 },
      ]);
    });
  });

  // =========================================================================
  // needsChunking
  // =========================================================================

  describe('needsChunking', () => {
    it('should return false for audio shorter than threshold', () => {
      const chunker = new AudioChunker();
      expect(chunker.needsChunking(300)).toBe(false);
    });

    it('should return false for audio exactly at threshold (420s)', () => {
      const chunker = new AudioChunker();
      expect(chunker.needsChunking(420)).toBe(false);
    });

    it('should return true for audio over threshold', () => {
      const chunker = new AudioChunker();
      expect(chunker.needsChunking(421)).toBe(true);
    });

    it('should return true for very long audio', () => {
      const chunker = new AudioChunker();
      expect(chunker.needsChunking(7200)).toBe(true);
    });

    it('should return false for zero duration', () => {
      const chunker = new AudioChunker();
      expect(chunker.needsChunking(0)).toBe(false);
    });

    it('should use custom chunkDurationSec from config', () => {
      const chunker = new AudioChunker({ chunkDurationSec: 60 });
      expect(chunker.needsChunking(60)).toBe(false);
      expect(chunker.needsChunking(61)).toBe(true);
    });
  });

  // =========================================================================
  // splitAudioFile
  // =========================================================================

  describe('splitAudioFile', () => {
    it('should return original file as single chunk when duration <= chunkDurationSec', async () => {
      const buf = fakeBuffer(1024);
      mockReadFileSync.mockReturnValue(buf);

      const chunker = new AudioChunker();
      const result = await chunker.splitAudioFile('/audio/test.webm', 300);

      expect(result.totalChunks).toBe(1);
      expect(result.totalDuration).toBe(300);
      expect(result.chunks).toHaveLength(1);

      const chunk = result.chunks[0];
      expect(chunk.index).toBe(0);
      expect(chunk.startTime).toBe(0);
      expect(chunk.endTime).toBe(300);
      expect(chunk.filePath).toBe('/audio/test.webm');
      expect(chunk.buffer).toBe(buf);

      // Should NOT create a temp directory or write files
      expect(mockMkdirSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should return original file when duration exactly equals chunkDurationSec', async () => {
      const buf = fakeBuffer(2048);
      mockReadFileSync.mockReturnValue(buf);

      const chunker = new AudioChunker();
      const result = await chunker.splitAudioFile('/audio/exact.webm', 420);

      expect(result.totalChunks).toBe(1);
      expect(result.chunks[0].filePath).toBe('/audio/exact.webm');
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should split a long file into multiple chunks and write them to disk', async () => {
      const fileSize = 84000; // easy math: 84000 bytes for 840 seconds -> 100 bytes/sec
      const buf = fakeBuffer(fileSize);
      mockReadFileSync.mockReturnValue(buf);
      mockExistsSync.mockReturnValue(false);

      const chunker = new AudioChunker();
      const result = await chunker.splitAudioFile('/audio/long.webm', 840);

      // With default config (420s, 3s overlap), step=417
      // Boundaries: [0,420], [417,837], [834,840]
      expect(result.totalChunks).toBe(3);
      expect(result.totalDuration).toBe(840);

      // Directory should be created
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('chunks'),
        { recursive: true }
      );

      // Each chunk should be written to disk
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3);

      // Verify chunk file paths follow the naming pattern
      for (let i = 0; i < result.chunks.length; i++) {
        const chunk = result.chunks[i];
        expect(chunk.index).toBe(i);
        expect(chunk.filePath).toContain(`chunk-${String(i).padStart(3, '0')}.webm`);
        expect(chunk.filePath).toContain('chunks');
      }

      // Verify first chunk starts from byte 0 (preserves header)
      const firstWriteCall = mockWriteFileSync.mock.calls[0];
      const firstChunkBuffer = firstWriteCall[1] as Buffer;
      // First chunk: subarray(0, endByte) where endByte = floor((420/840)*84000) = 42000
      expect(firstChunkBuffer.length).toBe(42000);
      // First byte should match the original buffer
      expect(firstChunkBuffer[0]).toBe(buf[0]);
    });

    it('should prepend header (first 4KB) to non-first chunks', async () => {
      const fileSize = 84000;
      const totalDuration = 840;
      const buf = fakeBuffer(fileSize);
      mockReadFileSync.mockReturnValue(buf);
      mockExistsSync.mockReturnValue(false);

      const chunker = new AudioChunker();
      const result = await chunker.splitAudioFile('/audio/long.webm', totalDuration);

      // Verify the second chunk has a header prepended
      // boundary[1] = { start: 417, end: 837 }
      // startByte = floor((417/840)*84000) = floor(41700) = 41700
      // endByte   = floor((837/840)*84000) = floor(83700) = 83700
      // headerSize = min(4096, 41700) = 4096
      // chunkBuffer = concat(header[0..4096], data[41700..83700])
      const secondChunk = result.chunks[1];
      const expectedStartByte = Math.floor((417 / totalDuration) * fileSize);
      const expectedEndByte = Math.floor((837 / totalDuration) * fileSize);
      const expectedHeaderSize = Math.min(4096, expectedStartByte);
      const expectedLength = expectedHeaderSize + (expectedEndByte - expectedStartByte);

      expect(secondChunk.buffer.length).toBe(expectedLength);

      // The first 4096 bytes of the chunk should match the original file header
      const headerPortion = secondChunk.buffer.subarray(0, expectedHeaderSize);
      const originalHeader = buf.subarray(0, expectedHeaderSize);
      expect(Buffer.compare(headerPortion, originalHeader)).toBe(0);

      // The data portion should match the corresponding slice of the original buffer
      const dataPortion = secondChunk.buffer.subarray(expectedHeaderSize);
      const originalSlice = buf.subarray(expectedStartByte, expectedEndByte);
      expect(Buffer.compare(dataPortion, originalSlice)).toBe(0);
    });

    it('should use min(4096, startByte) for header size when file is small', async () => {
      // Use a custom config with small chunks so that startByte < 4096
      const fileSize = 3000; // total bytes
      const totalDuration = 30; // seconds
      const buf = fakeBuffer(fileSize);
      mockReadFileSync.mockReturnValue(buf);
      mockExistsSync.mockReturnValue(false);

      const chunker = new AudioChunker({ chunkDurationSec: 10, overlapSec: 2 });
      const result = await chunker.splitAudioFile('/audio/small.webm', totalDuration);

      // step = 10 - 2 = 8
      // boundaries: [0,10], [8,18], [16,26], [24,30]
      expect(result.totalChunks).toBe(4);

      // For chunk[1]: startByte = floor((8/30)*3000) = 800
      // headerSize = min(4096, 800) = 800  (smaller than 4096)
      const chunk1 = result.chunks[1];
      const startByte1 = Math.floor((8 / totalDuration) * fileSize);
      const endByte1 = Math.floor((18 / totalDuration) * fileSize);
      const headerSize1 = Math.min(4096, startByte1);

      expect(headerSize1).toBe(800);
      expect(chunk1.buffer.length).toBe(headerSize1 + (endByte1 - startByte1));
    });

    it('should not re-create chunk directory if it already exists', async () => {
      const buf = fakeBuffer(10000);
      mockReadFileSync.mockReturnValue(buf);
      mockExistsSync.mockReturnValue(true); // directory already exists

      const chunker = new AudioChunker();
      await chunker.splitAudioFile('/audio/long.webm', 841);

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it('should include session timestamp in the chunk directory path', async () => {
      const buf = fakeBuffer(10000);
      mockReadFileSync.mockReturnValue(buf);
      mockExistsSync.mockReturnValue(false);

      const chunker = new AudioChunker();
      await chunker.splitAudioFile('/audio/long.webm', 841);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('session-1700000000000'),
        { recursive: true }
      );
    });
  });

  // =========================================================================
  // cleanupChunks
  // =========================================================================

  describe('cleanupChunks', () => {
    it('should remove files whose paths contain "chunks"', async () => {
      mockExistsSync.mockReturnValue(true);

      const chunkDir = nodePath.join('/mock', 'userData', 'temp', 'chunks', 'session-123');
      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: nodePath.join(chunkDir, 'chunk-000.webm') },
        { index: 1, startTime: 417, endTime: 840, buffer: Buffer.alloc(0), filePath: nodePath.join(chunkDir, 'chunk-001.webm') },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
      expect(mockUnlinkSync).toHaveBeenCalledWith(chunks[0].filePath);
      expect(mockUnlinkSync).toHaveBeenCalledWith(chunks[1].filePath);
    });

    it('should also attempt to remove the chunk directory', async () => {
      mockExistsSync.mockReturnValue(true);

      const chunkDir = nodePath.join('/mock', 'userData', 'temp', 'chunks', 'session-123');
      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: nodePath.join(chunkDir, 'chunk-000.webm') },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      // path.dirname of the chunk file path should yield the directory
      expect(mockRmdirSync).toHaveBeenCalledWith(chunkDir);
    });

    it('should NOT delete files whose paths do not contain "chunks" (safety guard)', async () => {
      mockExistsSync.mockReturnValue(true);

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 300, buffer: Buffer.alloc(0), filePath: '/audio/original-recording.webm' },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('should NOT delete files that do not exist on disk', async () => {
      mockExistsSync.mockReturnValue(false);

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: '/mock/userData/temp/chunks/session-123/chunk-000.webm' },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('should handle missing files gracefully without throwing', async () => {
      mockExistsSync.mockReturnValue(true);
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: '/mock/userData/temp/chunks/session-123/chunk-000.webm' },
      ];

      const chunker = new AudioChunker();

      // Should not throw even though unlinkSync throws internally
      await expect(chunker.cleanupChunks(chunks)).resolves.toBeUndefined();
    });

    it('should log an error when unlinkSync fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExistsSync.mockReturnValue(true);
      const unlinkError = new Error('EPERM: operation not permitted');
      mockUnlinkSync.mockImplementation(() => {
        throw unlinkError;
      });

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: '/mock/userData/temp/chunks/session-123/chunk-000.webm' },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AudioChunker] Failed to clean up chunk'),
        unlinkError
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty chunks array without errors', async () => {
      const chunker = new AudioChunker();

      await expect(chunker.cleanupChunks([])).resolves.toBeUndefined();
      expect(mockUnlinkSync).not.toHaveBeenCalled();
      expect(mockRmdirSync).not.toHaveBeenCalled();
    });

    it('should not throw when rmdirSync fails (directory not empty)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockRmdirSync.mockImplementation(() => {
        throw new Error('ENOTEMPTY: directory not empty');
      });

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: '/mock/userData/temp/chunks/session-123/chunk-000.webm' },
      ];

      const chunker = new AudioChunker();
      await expect(chunker.cleanupChunks(chunks)).resolves.toBeUndefined();
    });

    it('should not remove directory if its path does not contain "chunks"', async () => {
      mockExistsSync.mockReturnValue(true);

      const chunks: AudioChunk[] = [
        { index: 0, startTime: 0, endTime: 420, buffer: Buffer.alloc(0), filePath: '/audio/other-dir/chunk-000.webm' },
      ];

      const chunker = new AudioChunker();
      await chunker.cleanupChunks(chunks);

      // The file path doesn't contain 'chunks', so unlinkSync is not called
      expect(mockUnlinkSync).not.toHaveBeenCalled();
      // The directory (/audio/other-dir) doesn't contain 'chunks', so rmdirSync is not called
      expect(mockRmdirSync).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Constructor / Configuration
  // =========================================================================

  describe('constructor', () => {
    it('should use default config when no arguments provided', () => {
      const chunker = new AudioChunker();

      // Verify defaults via needsChunking behavior
      expect(chunker.needsChunking(420)).toBe(false);
      expect(chunker.needsChunking(421)).toBe(true);
    });

    it('should allow partial config override', () => {
      const chunker = new AudioChunker({ chunkDurationSec: 60 });

      // chunkDurationSec overridden to 60, overlapSec stays at default 3
      expect(chunker.needsChunking(60)).toBe(false);
      expect(chunker.needsChunking(61)).toBe(true);

      const boundaries = chunker.calculateChunkBoundaries(120);
      // step = 60 - 3 = 57
      // chunk 0: [0, 60], chunk 1: [57, 117], chunk 2: [114, 120]
      expect(boundaries[1].start).toBe(57); // verifies overlapSec=3 is default
    });

    it('should allow overriding both config values', () => {
      const chunker = new AudioChunker({ chunkDurationSec: 100, overlapSec: 10 });
      const boundaries = chunker.calculateChunkBoundaries(250);

      // step = 100 - 10 = 90
      // chunk 0: [0, 100], chunk 1: [90, 190], chunk 2: [180, 250]
      expect(boundaries).toEqual([
        { start: 0, end: 100 },
        { start: 90, end: 190 },
        { start: 180, end: 250 },
      ]);
    });
  });
});
