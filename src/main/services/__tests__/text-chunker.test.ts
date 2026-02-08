import { describe, it, expect } from 'vitest';
import { TextChunker, countWords } from '../text-chunker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a string with exactly `n` words separated by single spaces.
 */
function generateWords(n: number, prefix = 'word'): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

/**
 * Generate a multi-paragraph text where each paragraph has `wordsPerParagraph`
 * words, separated by a blank line (\n\n).
 */
function generateParagraphs(
  paragraphCount: number,
  wordsPerParagraph: number,
): string {
  return Array.from({ length: paragraphCount }, (_, i) =>
    generateWords(wordsPerParagraph, `p${i}w`),
  ).join('\n\n');
}

/**
 * Generate a single paragraph composed of multiple sentences,
 * each with `wordsPerSentence` words, delimited by ". ".
 */
function generateSentences(
  sentenceCount: number,
  wordsPerSentence: number,
): string {
  return Array.from({ length: sentenceCount }, (_, i) =>
    generateWords(wordsPerSentence, `s${i}w`),
  )
    .map((s) => s + '.')
    .join(' ');
}

// ===========================================================================
// countWords
// ===========================================================================

describe('countWords', () => {
  it('should return 0 for an empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('should return 0 for a string of only whitespace', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('\t\n ')).toBe(0);
  });

  it('should return 1 for a single word', () => {
    expect(countWords('hello')).toBe(1);
  });

  it('should count multiple words correctly', () => {
    expect(countWords('one two three')).toBe(3);
  });

  it('should handle extra whitespace between words', () => {
    expect(countWords('  one   two   three  ')).toBe(3);
  });

  it('should handle tabs and newlines as separators', () => {
    expect(countWords('one\ttwo\nthree')).toBe(3);
  });

  it('should return 0 for null-ish / falsy values cast to string guard', () => {
    // The implementation guards with `if (!text ...)` so passing falsy values
    // that the runtime could produce (e.g. undefined cast via any) should be 0.
    expect(countWords(undefined as unknown as string)).toBe(0);
    expect(countWords(null as unknown as string)).toBe(0);
  });

  it('should count Korean words separated by spaces', () => {
    expect(countWords('안녕하세요 세계 여러분')).toBe(3);
  });

  it('should handle mixed Korean and English', () => {
    expect(countWords('hello 세계 world')).toBe(3);
  });
});

// ===========================================================================
// TextChunker - needsChunking
// ===========================================================================

describe('TextChunker - needsChunking', () => {
  const chunker = new TextChunker(); // default config: maxWordsPerChunk = 2000

  it('should return false for short text', () => {
    expect(chunker.needsChunking('short text here')).toBe(false);
  });

  it('should return false when word count is exactly at the limit', () => {
    const text = generateWords(2000);
    expect(countWords(text)).toBe(2000);
    expect(chunker.needsChunking(text)).toBe(false);
  });

  it('should return true when word count exceeds the limit by one', () => {
    const text = generateWords(2001);
    expect(chunker.needsChunking(text)).toBe(true);
  });

  it('should return false for an empty string', () => {
    expect(chunker.needsChunking('')).toBe(false);
  });
});

// ===========================================================================
// TextChunker - chunkText
// ===========================================================================

describe('TextChunker - chunkText', () => {
  // Use a small limit so we do not need huge test strings.
  const chunker = new TextChunker({ maxWordsPerChunk: 10 });

  // ------- empty / short text -------

  it('should return an empty array for empty text', () => {
    expect(chunker.chunkText('')).toEqual([]);
  });

  it('should return an empty array for whitespace-only text', () => {
    expect(chunker.chunkText('   \n  ')).toEqual([]);
  });

  it('should return a single chunk when text is within the limit', () => {
    const text = 'one two three four five';
    const chunks = chunker.chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].wordCount).toBe(5);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(text.length);
  });

  // ------- paragraph-level splitting -------

  it('should split on paragraph boundaries when paragraphs fit within limits', () => {
    // 3 paragraphs of 5 words each = 15 words total, limit = 10
    const text = generateParagraphs(3, 5);
    const chunks = chunker.chunkText(text);

    // First two paragraphs (10 words) should form one chunk,
    // third paragraph (5 words) another.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(10);
    }
  });

  it('should assign sequential index numbers to chunks', () => {
    const text = generateParagraphs(4, 5); // 20 words, limit 10
    const chunks = chunker.chunkText(text);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  // ------- sentence-level splitting within a large paragraph -------

  it('should split a very long single paragraph by sentences', () => {
    // One paragraph with many sentences, each 3 words, total well over 10.
    const text = generateSentences(8, 3); // 8 sentences x ~4 tokens each
    const chunks = chunker.chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(10);
    }
  });

  it('should not produce chunks whose word count exceeds maxWordsPerChunk', () => {
    // Mix paragraphs + long paragraphs
    const shortParagraph = generateWords(4);
    const longParagraph = generateSentences(6, 3);
    const text = [shortParagraph, longParagraph, shortParagraph].join('\n\n');

    const chunks = chunker.chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(10);
    }
  });

  // ------- Korean text -------

  it('should chunk Korean text correctly', () => {
    // Korean words separated by spaces (each "sentence" ends with .)
    const koreanSentences = Array.from(
      { length: 6 },
      (_, i) => `한국어${i} 테스트${i} 문장${i}.`,
    ).join(' ');

    const chunks = chunker.chunkText(koreanSentences);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(10);
    }
  });

  // ------- startOffset / endOffset -------

  it('should provide startOffset of 0 for the first chunk', () => {
    const text = generateParagraphs(3, 5);
    const chunks = chunker.chunkText(text);

    expect(chunks[0].startOffset).toBe(0);
  });

  it('should set endOffset equal to text.length for the last chunk', () => {
    const text = generateParagraphs(3, 5);
    const chunks = chunker.chunkText(text);
    const lastChunk = chunks[chunks.length - 1];

    expect(lastChunk.endOffset).toBe(text.length);
  });

  // ------- single chunk returns trimmed text -------

  it('should trim text in a single-chunk result', () => {
    const text = '  hello world  ';
    const chunks = chunker.chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('hello world');
  });

  // ------- null/undefined guard -------

  it('should return an empty array for null-ish input', () => {
    expect(chunker.chunkText(null as unknown as string)).toEqual([]);
    expect(chunker.chunkText(undefined as unknown as string)).toEqual([]);
  });
});

// ===========================================================================
// TextChunker - chunkText (default config, 2000 words)
// ===========================================================================

describe('TextChunker - chunkText with default config', () => {
  const chunker = new TextChunker();

  it('should return a single chunk for text under 2000 words', () => {
    const text = generateWords(500);
    const chunks = chunker.chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBe(500);
  });

  it('should split text exceeding 2000 words into multiple chunks', () => {
    // 5 paragraphs of 800 words = 4000 words total
    const text = generateParagraphs(5, 800);
    const chunks = chunker.chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
    expect(totalWords).toBe(4000);

    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(2000);
    }
  });
});

// ===========================================================================
// TextChunker - mergeChunks
// ===========================================================================

describe('TextChunker - mergeChunks', () => {
  const chunker = new TextChunker();

  it('should return an empty string for an empty array', () => {
    expect(chunker.mergeChunks([])).toBe('');
  });

  it('should return the single chunk as-is (trimmed)', () => {
    expect(chunker.mergeChunks(['Hello world'])).toBe('Hello world');
  });

  it('should join multiple chunks with double newlines', () => {
    const result = chunker.mergeChunks(['Chunk one.', 'Chunk two.', 'Chunk three.']);
    expect(result).toBe('Chunk one.\n\nChunk two.\n\nChunk three.');
  });

  it('should trim leading/trailing whitespace from the merged result', () => {
    const result = chunker.mergeChunks(['  Leading space.', 'Trailing space.  ']);
    expect(result).toBe('Leading space.\n\nTrailing space.');
  });
});

// ===========================================================================
// TextChunker - custom config
// ===========================================================================

describe('TextChunker - custom config', () => {
  it('should produce more chunks with a smaller maxWordsPerChunk', () => {
    const text = generateParagraphs(4, 10); // 40 words across 4 paragraphs

    const largeChunker = new TextChunker({ maxWordsPerChunk: 40 });
    const smallChunker = new TextChunker({ maxWordsPerChunk: 10 });

    const largeChunks = largeChunker.chunkText(text);
    const smallChunks = smallChunker.chunkText(text);

    expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
  });

  it('should accept partial config and merge with defaults', () => {
    // Only override maxWordsPerChunk; overlapSentences should keep default (0).
    const chunker = new TextChunker({ maxWordsPerChunk: 50 });

    // The chunker should function normally -- verify by chunking short text.
    const text = generateWords(30);
    const chunks = chunker.chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBe(30);
  });

  it('should use default config when no config is provided', () => {
    const chunker = new TextChunker();
    // Default limit is 2000 words; 100 words should not require chunking.
    expect(chunker.needsChunking(generateWords(100))).toBe(false);
    expect(chunker.needsChunking(generateWords(2001))).toBe(true);
  });
});

// ===========================================================================
// TextChunker - round-trip: chunk then merge preserves all content
// ===========================================================================

describe('TextChunker - round-trip integrity', () => {
  it('should preserve all words after chunking and merging', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 10 });
    const originalText = generateParagraphs(4, 8); // 32 words, 4 paragraphs

    const chunks = chunker.chunkText(originalText);
    const merged = chunker.mergeChunks(chunks.map((c) => c.text));

    // Word counts should match (content preservation).
    expect(countWords(merged)).toBe(countWords(originalText));
  });

  it('should yield the same text when a single chunk is merged', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 100 });
    const text = 'Short text that fits in one chunk.';
    const chunks = chunker.chunkText(text);
    const merged = chunker.mergeChunks(chunks.map((c) => c.text));

    expect(merged).toBe(text.trim());
  });
});

// ===========================================================================
// Edge cases / stress
// ===========================================================================

describe('TextChunker - edge cases', () => {
  it('should handle text that is exactly at the word limit', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 10 });
    const text = generateWords(10);
    const chunks = chunker.chunkText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBe(10);
  });

  it('should handle text that is one word over the limit', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 10 });
    // Two paragraphs: 6 + 5 = 11 words, just over the limit.
    const text = generateParagraphs(2, 6);
    // This has 12 words total (two paragraphs of 6). Will need two chunks.
    const chunks = chunker.chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle text with only newlines and spaces', () => {
    const chunker = new TextChunker();
    expect(chunker.chunkText('\n\n\n   \n\n')).toEqual([]);
  });

  it('should handle a single very long word (no split points)', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 5 });
    // A single word is under any per-word limit (1 word <= 5).
    const text = 'superlongwordwithoutspaces';
    const chunks = chunker.chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].wordCount).toBe(1);
  });

  it('should handle text with mixed paragraph separators', () => {
    const chunker = new TextChunker({ maxWordsPerChunk: 5 });
    const text = 'first paragraph words here.\n\nsecond paragraph words here.\n\nthird paragraph words here.';
    const chunks = chunker.chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.wordCount).toBeLessThanOrEqual(5);
    }
  });
});
