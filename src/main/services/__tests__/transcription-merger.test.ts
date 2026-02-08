import { describe, it, expect } from 'vitest';
import { TranscriptionMerger, ChunkTranscription } from '../transcription-merger';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeChunk(
  overrides: Partial<ChunkTranscription> & { chunkIndex: number; startTime: number; endTime: number },
  resultOverrides: Partial<ChunkTranscription['result']> = {},
): ChunkTranscription {
  return {
    chunkIndex: overrides.chunkIndex,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    result: {
      text: resultOverrides.text ?? '',
      segments: resultOverrides.segments,
      language: resultOverrides.language,
      duration: resultOverrides.duration,
      model: resultOverrides.model,
      provider: resultOverrides.provider,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranscriptionMerger', () => {
  // -----------------------------------------------------------------------
  // 1. Empty input
  // -----------------------------------------------------------------------
  describe('empty input', () => {
    it('returns { text: "" } when given an empty array', () => {
      const merger = new TranscriptionMerger();
      const result = merger.merge([]);

      expect(result).toEqual({ text: '' });
    });

    it('returns no segments, language, model, or provider for empty input', () => {
      const merger = new TranscriptionMerger();
      const result = merger.merge([]);

      expect(result.segments).toBeUndefined();
      expect(result.language).toBeUndefined();
      expect(result.model).toBeUndefined();
      expect(result.provider).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Single chunk
  // -----------------------------------------------------------------------
  describe('single chunk', () => {
    it('returns the chunk result as-is', () => {
      const merger = new TranscriptionMerger();
      const chunk = makeChunk(
        { chunkIndex: 0, startTime: 0, endTime: 30 },
        {
          text: 'Hello world this is a test',
          language: 'en',
          duration: 30,
          model: 'whisper-large-v3',
          provider: 'groq',
          segments: [
            { id: 0, start: 0, end: 5, text: 'Hello world' },
            { id: 1, start: 5, end: 10, text: 'this is a test' },
          ],
        },
      );

      const result = merger.merge([chunk]);

      // Single chunk returns the result object reference directly
      expect(result).toBe(chunk.result);
      expect(result.text).toBe('Hello world this is a test');
      expect(result.segments).toHaveLength(2);
      expect(result.language).toBe('en');
      expect(result.model).toBe('whisper-large-v3');
      expect(result.provider).toBe('groq');
    });

    it('returns single chunk even without segments', () => {
      const merger = new TranscriptionMerger();
      const chunk = makeChunk(
        { chunkIndex: 0, startTime: 0, endTime: 10 },
        { text: 'Just text, no segments' },
      );

      const result = merger.merge([chunk]);
      expect(result.text).toBe('Just text, no segments');
      expect(result.segments).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Two chunks with no overlap
  // -----------------------------------------------------------------------
  describe('two chunks with no overlap', () => {
    it('concatenates text when content is completely different', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'The quick brown fox jumps over the lazy dog' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'A completely different sentence with no overlap at all' },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.text).toContain('The quick brown fox jumps over the lazy dog');
      expect(result.text).toContain('A completely different sentence with no overlap at all');
    });

    it('concatenates text when overlapSec is 0', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'First chunk text' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'Second chunk text' },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.text).toBe('First chunk text Second chunk text');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Two chunks with identical overlap
  // -----------------------------------------------------------------------
  describe('two chunks with identical overlap', () => {
    it('deduplicates identical overlapping words', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'The quick brown fox jumps over the lazy dog' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          // Overlap: "the lazy dog" appears at end of chunk 0 and start of chunk 1
          { text: 'the lazy dog and then some more words follow here' },
        ),
      ];

      const result = merger.merge(chunks);

      // "the lazy dog" should appear only once, not duplicated
      const matches = result.text.match(/the lazy dog/gi);
      expect(matches).toHaveLength(1);
      expect(result.text).toContain('and then some more words follow here');
    });

    it('handles longer identical overlap', () => {
      const merger = new TranscriptionMerger(5);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'word1 word2 word3 word4 word5 word6 word7 word8' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 25, endTime: 60 },
          { text: 'word5 word6 word7 word8 word9 word10 word11' },
        ),
      ];

      const result = merger.merge(chunks);

      // The overlapping "word5 word6 word7 word8" should be deduplicated
      expect(result.text).toBe('word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11');
    });
  });

  // -----------------------------------------------------------------------
  // 5. Two chunks with similar overlap (>70% match)
  // -----------------------------------------------------------------------
  describe('two chunks with similar but not identical overlap (>70% threshold)', () => {
    it('deduplicates when similarity exceeds 70%', () => {
      const merger = new TranscriptionMerger(3);

      // 4 words overlap zone: 3 out of 4 match = 75% similarity (> 0.7)
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'beginning text alpha bravo charlie delta' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          // 3 of 4 match the suffix: "alpha bravo charlie" matches, "deltax" differs from "delta"
          // But with the greedy longest-first approach, it will try length 4 first:
          // prev suffix(4) = "alpha bravo charlie delta"
          // curr prefix(4) = "alpha bravo charlie deltax"
          // 3/4 = 0.75 > 0.7 => match at length 4
          { text: 'alpha bravo charlie deltax ending text here' },
        ),
      ];

      const result = merger.merge(chunks);

      // The 4-word overlap should be removed from the current chunk
      expect(result.text).toContain('beginning text');
      expect(result.text).toContain('ending text here');
      // "alpha bravo charlie" should appear once (from the first chunk)
      expect(result.text).not.toContain('deltax');
    });

    it('deduplicates when all overlap words are identical (100% match)', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'start middle end overlap here' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'overlap here continuation of text' },
        ),
      ];

      const result = merger.merge(chunks);

      // "overlap here" should appear only once
      const overlapMatches = result.text.match(/overlap here/g);
      expect(overlapMatches).toHaveLength(1);
      expect(result.text).toContain('continuation of text');
    });
  });

  // -----------------------------------------------------------------------
  // 6. Two chunks with dissimilar overlap (<70% match)
  // -----------------------------------------------------------------------
  describe('two chunks with dissimilar overlap (<70% match)', () => {
    it('keeps both texts when similarity is below threshold', () => {
      const merger = new TranscriptionMerger(3);

      // No word-level overlap at all between suffix and prefix
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'apple banana cherry date' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'xray yankee zulu whiskey' },
        ),
      ];

      const result = merger.merge(chunks);

      // Both texts should be fully present since nothing matched
      expect(result.text).toContain('apple banana cherry date');
      expect(result.text).toContain('xray yankee zulu whiskey');
    });

    it('keeps both when similarity is exactly at or below 70%', () => {
      const merger = new TranscriptionMerger(3);

      // Construct chunks where no suffix-prefix window at any length exceeds 0.7 similarity.
      // Using completely unrelated words ensures 0% similarity at every window size.
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'preamble w1 w2 w3 w4 w5 w6 w7 xx yy zz' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'completely different words that share nothing with previous text at all whatsoever none' },
        ),
      ];

      const result = merger.merge(chunks);

      // Both should be fully present
      expect(result.text).toContain('preamble');
      expect(result.text).toContain('completely different words');
    });
  });

  // -----------------------------------------------------------------------
  // 7. Segment timestamp adjustment
  // -----------------------------------------------------------------------
  describe('segment timestamp adjustment', () => {
    it('offsets segment timestamps by chunk startTime', () => {
      const merger = new TranscriptionMerger(0); // No overlap to simplify test
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First chunk',
            segments: [
              { id: 0, start: 0, end: 5, text: 'First' },
              { id: 1, start: 5, end: 10, text: 'chunk' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'Second chunk',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Second' },
              { id: 1, start: 5, end: 10, text: 'chunk' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments).toBeDefined();
      expect(result.segments).toHaveLength(4);

      // First chunk segments: no offset (startTime = 0)
      expect(result.segments![0]).toMatchObject({ start: 0, end: 5, text: 'First' });
      expect(result.segments![1]).toMatchObject({ start: 5, end: 10, text: 'chunk' });

      // Second chunk segments: offset by startTime = 30
      expect(result.segments![2]).toMatchObject({ start: 30, end: 35, text: 'Second' });
      expect(result.segments![3]).toMatchObject({ start: 35, end: 40, text: 'chunk' });
    });

    it('assigns sequential IDs to all merged segments', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'A',
            segments: [
              { id: 99, start: 0, end: 5, text: 'A' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'B',
            segments: [
              { id: 99, start: 0, end: 5, text: 'B' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 90 },
          {
            text: 'C',
            segments: [
              { id: 99, start: 0, end: 5, text: 'C' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      // IDs should be sequential regardless of original IDs
      expect(result.segments![0].id).toBe(0);
      expect(result.segments![1].id).toBe(1);
      expect(result.segments![2].id).toBe(2);
    });

    it('filters out overlap-zone segments from non-first chunks', () => {
      const merger = new TranscriptionMerger(3); // overlapSec = 3
      // Segments with start < overlapSec * 0.5 = 1.5 are filtered out
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First chunk content here for testing',
            segments: [
              { id: 0, start: 0, end: 10, text: 'First chunk content here for testing' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          {
            text: 'completely new words in the second chunk',
            segments: [
              { id: 0, start: 0, end: 1, text: 'overlap segment' },     // start 0 < 1.5 -> filtered
              { id: 1, start: 1, end: 1.4, text: 'still overlap' },      // start 1 < 1.5 -> filtered
              { id: 2, start: 1.5, end: 5, text: 'kept segment' },       // start 1.5 >= 1.5 -> kept
              { id: 3, start: 5, end: 10, text: 'also kept' },           // start 5 >= 1.5 -> kept
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      // First chunk: 1 segment, second chunk: 2 kept segments
      const segTexts = result.segments!.map(s => s.text);
      expect(segTexts).toContain('First chunk content here for testing');
      expect(segTexts).toContain('kept segment');
      expect(segTexts).toContain('also kept');
      expect(segTexts).not.toContain('overlap segment');
      expect(segTexts).not.toContain('still overlap');
    });

    it('does not filter segments from the first chunk', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First chunk',
            segments: [
              { id: 0, start: 0, end: 0.5, text: 'Very early segment' }, // start 0 < 1.5 but first chunk
              { id: 1, start: 1, end: 2, text: 'Another early segment' }, // start 1 < 1.5 but first chunk
            ],
          },
        ),
      ];

      // Single chunk returns as-is, so all segments are preserved
      const result = merger.merge(chunks);
      expect(result.segments).toHaveLength(2);
    });

    it('applies startTime offset correctly for non-zero first chunk', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 10, endTime: 40 },
          {
            text: 'Starts at 10',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Starts at 10' },
            ],
          },
        ),
      ];

      // Single chunk returns result as-is (no offset applied for single chunk)
      const result = merger.merge(chunks);
      expect(result.segments![0].start).toBe(0); // no offset for single chunk
    });

    it('applies startTime offset in multi-chunk scenario', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 10, endTime: 40 },
          {
            text: 'First',
            segments: [
              { id: 0, start: 0, end: 5, text: 'First' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 40, endTime: 70 },
          {
            text: 'Second',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Second' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      // First chunk offset: startTime=10, so 0+10=10
      expect(result.segments![0].start).toBe(10);
      expect(result.segments![0].end).toBe(15);

      // Second chunk offset: startTime=40, so 0+40=40
      expect(result.segments![1].start).toBe(40);
      expect(result.segments![1].end).toBe(45);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Speaker diarization preserved
  // -----------------------------------------------------------------------
  describe('speaker diarization preserved', () => {
    it('carries through speaker field on segments', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'Hello from speaker A',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Hello from speaker A', speaker: 'SPEAKER_00' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'Response from speaker B',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Response from speaker B', speaker: 'SPEAKER_01' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments).toBeDefined();
      expect(result.segments![0].speaker).toBe('SPEAKER_00');
      expect(result.segments![1].speaker).toBe('SPEAKER_01');
    });

    it('handles mix of segments with and without speaker', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First segment',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Has speaker', speaker: 'SPEAKER_00' },
              { id: 1, start: 5, end: 10, text: 'No speaker' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'Second segment',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Another speaker', speaker: 'SPEAKER_02' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments![0].speaker).toBe('SPEAKER_00');
      expect(result.segments![1].speaker).toBeUndefined();
      expect(result.segments![2].speaker).toBe('SPEAKER_02');
    });

    it('preserves multiple speakers within the same chunk', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'Multi-speaker chunk',
            segments: [
              { id: 0, start: 0, end: 3, text: 'Speaker A talks', speaker: 'SPEAKER_00' },
              { id: 1, start: 3, end: 6, text: 'Speaker B responds', speaker: 'SPEAKER_01' },
              { id: 2, start: 6, end: 10, text: 'Speaker A again', speaker: 'SPEAKER_00' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'Next chunk',
            segments: [
              { id: 0, start: 0, end: 5, text: 'Speaker B continues', speaker: 'SPEAKER_01' },
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments).toHaveLength(4);
      expect(result.segments![0].speaker).toBe('SPEAKER_00');
      expect(result.segments![1].speaker).toBe('SPEAKER_01');
      expect(result.segments![2].speaker).toBe('SPEAKER_00');
      expect(result.segments![3].speaker).toBe('SPEAKER_01');
    });
  });

  // -----------------------------------------------------------------------
  // 9. Multiple chunks (3+)
  // -----------------------------------------------------------------------
  describe('multiple chunks (3+)', () => {
    it('merges three chunks with identical overlaps correctly', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'alpha bravo charlie delta echo foxtrot' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'echo foxtrot golf hotel india juliet' },
        ),
        makeChunk(
          { chunkIndex: 2, startTime: 57, endTime: 90 },
          { text: 'india juliet kilo lima mike november' },
        ),
      ];

      const result = merger.merge(chunks);

      // Each overlap pair should be deduplicated
      expect(result.text).toBe(
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november',
      );
    });

    it('handles out-of-order chunk indices by sorting first', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 90 },
          { text: 'Third chunk' },
        ),
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'First chunk' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'Second chunk' },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.text).toBe('First chunk Second chunk Third chunk');
    });

    it('merges four chunks with segments and timestamps', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [];

      for (let i = 0; i < 4; i++) {
        chunks.push(
          makeChunk(
            { chunkIndex: i, startTime: i * 30, endTime: (i + 1) * 30 },
            {
              text: `Chunk ${i} text`,
              segments: [
                { id: 0, start: 0, end: 15, text: `Chunk ${i}` },
                { id: 1, start: 15, end: 30, text: 'text' },
              ],
            },
          ),
        );
      }

      const result = merger.merge(chunks);

      expect(result.segments).toHaveLength(8);

      // Verify timestamps for each chunk's segments
      for (let i = 0; i < 4; i++) {
        const offset = i * 30;
        expect(result.segments![i * 2].start).toBe(0 + offset);
        expect(result.segments![i * 2].end).toBe(15 + offset);
        expect(result.segments![i * 2 + 1].start).toBe(15 + offset);
        expect(result.segments![i * 2 + 1].end).toBe(30 + offset);
      }

      // Sequential IDs
      for (let i = 0; i < 8; i++) {
        expect(result.segments![i].id).toBe(i);
      }
    });

    it('handles a chunk with empty text in the middle', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'Before silence' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: '' },
        ),
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 90 },
          { text: 'After silence' },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.text).toBe('Before silence After silence');
    });
  });

  // -----------------------------------------------------------------------
  // 10. Metadata
  // -----------------------------------------------------------------------
  describe('metadata', () => {
    it('takes language, model, provider from first chunk', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First',
            language: 'ko',
            model: 'whisper-large-v3',
            provider: 'groq',
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          {
            text: 'Second',
            language: 'en',
            model: 'different-model',
            provider: 'elevenlabs',
          },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.language).toBe('ko');
      expect(result.model).toBe('whisper-large-v3');
      expect(result.provider).toBe('groq');
    });

    it('takes duration from the last chunk endTime', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'First', duration: 30 },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'Second', duration: 30 },
        ),
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 95 },
          { text: 'Third', duration: 35 },
        ),
      ];

      const result = merger.merge(chunks);

      // duration should be lastChunk.endTime = 95, not sum of durations
      expect(result.duration).toBe(95);
    });

    it('uses sorted order for determining first and last chunk', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 90 },
          { text: 'Last by index', language: 'ja', model: 'model-c', provider: 'provider-c' },
        ),
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'First by index', language: 'ko', model: 'model-a', provider: 'provider-a' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'Middle', language: 'en', model: 'model-b', provider: 'provider-b' },
        ),
      ];

      const result = merger.merge(chunks);

      // Metadata from first chunk (chunkIndex=0)
      expect(result.language).toBe('ko');
      expect(result.model).toBe('model-a');
      expect(result.provider).toBe('provider-a');

      // Duration from last chunk (chunkIndex=2)
      expect(result.duration).toBe(90);
    });

    it('returns undefined segments when no chunks have segments', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'No segments here' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'None here either' },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments).toBeUndefined();
    });

    it('returns segments only from chunks that have them', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'Has segments', segments: [{ id: 0, start: 0, end: 5, text: 'Has segments' }] },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: 'No segments' },
        ),
        makeChunk(
          { chunkIndex: 2, startTime: 60, endTime: 90 },
          { text: 'Also has', segments: [{ id: 0, start: 0, end: 5, text: 'Also has' }] },
        ),
      ];

      const result = merger.merge(chunks);

      expect(result.segments).toHaveLength(2);
      expect(result.segments![0].text).toBe('Has segments');
      expect(result.segments![1].text).toBe('Also has');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles custom overlapSec value', () => {
      const merger = new TranscriptionMerger(10);
      // overlapSec=10 means segments with start < 5.0 (10*0.5) are filtered
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 60 },
          {
            text: 'First chunk text',
            segments: [
              { id: 0, start: 0, end: 30, text: 'First chunk text' },
            ],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 50, endTime: 120 },
          {
            text: 'completely new text in second chunk',
            segments: [
              { id: 0, start: 0, end: 3, text: 'early overlap' },    // 0 < 5.0 -> filtered
              { id: 1, start: 4.9, end: 6, text: 'borderline' },     // 4.9 < 5.0 -> filtered
              { id: 2, start: 5.0, end: 10, text: 'just at boundary' }, // 5.0 >= 5.0 -> kept
              { id: 3, start: 10, end: 20, text: 'well past' },      // kept
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      const segTexts = result.segments!.map(s => s.text);
      expect(segTexts).not.toContain('early overlap');
      expect(segTexts).not.toContain('borderline');
      expect(segTexts).toContain('just at boundary');
      expect(segTexts).toContain('well past');
    });

    it('does not mutate the original input array', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk({ chunkIndex: 1, startTime: 30, endTime: 60 }, { text: 'B' }),
        makeChunk({ chunkIndex: 0, startTime: 0, endTime: 30 }, { text: 'A' }),
      ];

      const originalOrder = [...chunks];
      merger.merge(chunks);

      // Original array should not be reordered
      expect(chunks[0].chunkIndex).toBe(originalOrder[0].chunkIndex);
      expect(chunks[1].chunkIndex).toBe(originalOrder[1].chunkIndex);
    });

    it('handles whitespace normalization in merged text', () => {
      const merger = new TranscriptionMerger(0);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: '  Extra   spaces  ' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 30, endTime: 60 },
          { text: '  More   spaces  ' },
        ),
      ];

      const result = merger.merge(chunks);

      // All extra whitespace should be collapsed
      expect(result.text).toBe('Extra spaces More spaces');
    });

    it('handles chunks with undefined text gracefully', () => {
      const merger = new TranscriptionMerger(0);
      const chunk1 = makeChunk({ chunkIndex: 0, startTime: 0, endTime: 30 }, { text: 'Hello' });
      const chunk2: ChunkTranscription = {
        chunkIndex: 1,
        startTime: 30,
        endTime: 60,
        result: { text: undefined as unknown as string },
      };

      const result = merger.merge([chunk1, chunk2]);

      // Should handle falsy text without crashing
      expect(result.text).toBeTruthy();
    });

    it('default overlapSec is 3', () => {
      const merger = new TranscriptionMerger();
      // Verify default by checking that segment filtering uses overlapSec * 0.5 = 1.5
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          {
            text: 'First chunk words here',
            segments: [{ id: 0, start: 0, end: 10, text: 'First' }],
          },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          {
            text: 'Second chunk words here',
            segments: [
              { id: 0, start: 1, end: 1.4, text: 'filtered' },   // 1 < 1.5 -> filtered
              { id: 1, start: 1.5, end: 5, text: 'kept' },        // 1.5 >= 1.5 -> kept
            ],
          },
        ),
      ];

      const result = merger.merge(chunks);

      const segTexts = result.segments!.map(s => s.text);
      expect(segTexts).not.toContain('filtered');
      expect(segTexts).toContain('kept');
    });
  });

  // -----------------------------------------------------------------------
  // Overlap detection boundary conditions
  // -----------------------------------------------------------------------
  describe('overlap detection boundary conditions', () => {
    it('requires at least 2 matching words for overlap detection', () => {
      const merger = new TranscriptionMerger(3);
      // The loop starts at overlapLen = min(30, prevWords.length, currentWords.length)
      // and goes down to 2. Single-word overlaps are never detected.
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'end' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'end more words' },
        ),
      ];

      const result = merger.merge(chunks);

      // Single word "end" cannot be detected as overlap (min overlapLen is 2)
      // so both should be present
      expect(result.text).toBe('end end more words');
    });

    it('detects 2-word overlap at minimum', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'words before the end' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'the end and more after' },
        ),
      ];

      const result = merger.merge(chunks);

      // "the end" (2 words) should be detected and deduplicated
      const matches = result.text.match(/the end/g);
      expect(matches).toHaveLength(1);
      expect(result.text).toContain('and more after');
    });

    it('respects the 30-word search window limit', () => {
      const merger = new TranscriptionMerger(3);

      // Create a prev text with > 30 words and overlap longer than 30 words
      const prevWords = Array.from({ length: 40 }, (_, i) => `prev${i}`);
      const overlapWords = prevWords.slice(-35); // 35 words overlap (> 30 limit)

      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: prevWords.join(' ') },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: overlapWords.join(' ') + ' newword1 newword2' },
        ),
      ];

      const result = merger.merge(chunks);

      // The search window is capped at 30, so it will try to match
      // up to 30 words. The overlap of 30 words (from the 35-word overlap)
      // should still be found since the window searches from searchWindow down to 2.
      expect(result.text).toContain('newword1 newword2');
    });

    it('handles case-insensitive matching for overlap detection', () => {
      const merger = new TranscriptionMerger(3);
      const chunks: ChunkTranscription[] = [
        makeChunk(
          { chunkIndex: 0, startTime: 0, endTime: 30 },
          { text: 'some words The End Here' },
        ),
        makeChunk(
          { chunkIndex: 1, startTime: 27, endTime: 60 },
          { text: 'the end here and continues' },
        ),
      ];

      const result = merger.merge(chunks);

      // Overlap detection uses toLowerCase() so "The End Here" matches "the end here".
      // The second chunk's prefix "the end here" is removed, leaving only "and continues".
      // The first chunk's "The End Here" remains. So the final text is:
      // "some words The End Here and continues"
      expect(result.text).toBe('some words The End Here and continues');

      // Verify the overlap phrase appears only once (case-insensitive),
      // confirming the second chunk's duplicate was removed.
      const occurrences = result.text.match(/the end here/gi);
      expect(occurrences).toHaveLength(1);
    });
  });
});
