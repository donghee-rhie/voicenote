export interface TextChunkConfig {
  maxWordsPerChunk: number;
  overlapSentences: number;  // Number of sentences to overlap for context
}

export interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  startOffset: number;  // Character offset in original text
  endOffset: number;
}

const DEFAULT_CONFIG: TextChunkConfig = {
  maxWordsPerChunk: 2000,
  overlapSentences: 0,  // No overlap for refinement (just split and rejoin)
};

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Split text into sentences using common sentence-ending patterns
 */
function splitIntoSentences(text: string): string[] {
  // Handle Korean, English, and other languages
  // Split on sentence-ending punctuation followed by space or newline
  const sentences = text.split(/(?<=[.!?。！？\n])\s+/);
  return sentences.filter(s => s.trim().length > 0);
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.filter(p => p.trim().length > 0);
}

/**
 * TextChunker - splits long text into manageable chunks for LLM processing
 */
export class TextChunker {
  private config: TextChunkConfig;

  constructor(config: Partial<TextChunkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if text needs chunking
   */
  needsChunking(text: string): boolean {
    return countWords(text) > this.config.maxWordsPerChunk;
  }

  /**
   * Split text into chunks respecting sentence boundaries
   */
  chunkText(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const totalWords = countWords(text);
    if (totalWords <= this.config.maxWordsPerChunk) {
      return [{
        index: 0,
        text: text.trim(),
        wordCount: totalWords,
        startOffset: 0,
        endOffset: text.length,
      }];
    }

    // First try paragraph-based splitting
    const paragraphs = splitIntoParagraphs(text);
    const chunks: TextChunk[] = [];
    let currentChunkParts: string[] = [];
    let currentWordCount = 0;
    let currentStartOffset = 0;
    let charOffset = 0;

    for (const paragraph of paragraphs) {
      const paragraphWords = countWords(paragraph);

      // If a single paragraph exceeds max, split by sentences
      if (paragraphWords > this.config.maxWordsPerChunk) {
        // Flush current chunk first
        if (currentChunkParts.length > 0) {
          const chunkText = currentChunkParts.join('\n\n');
          chunks.push({
            index: chunks.length,
            text: chunkText,
            wordCount: currentWordCount,
            startOffset: currentStartOffset,
            endOffset: charOffset,
          });
          currentChunkParts = [];
          currentWordCount = 0;
          currentStartOffset = charOffset;
        }

        // Split paragraph by sentences
        const sentences = splitIntoSentences(paragraph);
        let sentenceParts: string[] = [];
        let sentenceWordCount = 0;

        for (const sentence of sentences) {
          const sentenceWords = countWords(sentence);

          if (sentenceWordCount + sentenceWords > this.config.maxWordsPerChunk && sentenceParts.length > 0) {
            const chunkText = sentenceParts.join(' ');
            chunks.push({
              index: chunks.length,
              text: chunkText,
              wordCount: sentenceWordCount,
              startOffset: currentStartOffset,
              endOffset: currentStartOffset + chunkText.length,
            });
            sentenceParts = [];
            sentenceWordCount = 0;
            currentStartOffset = currentStartOffset + chunkText.length + 1;
          }

          sentenceParts.push(sentence);
          sentenceWordCount += sentenceWords;
        }

        if (sentenceParts.length > 0) {
          currentChunkParts = sentenceParts;
          currentWordCount = sentenceWordCount;
        }
      } else if (currentWordCount + paragraphWords > this.config.maxWordsPerChunk) {
        // Current paragraph would exceed limit, flush current chunk
        const chunkText = currentChunkParts.join('\n\n');
        chunks.push({
          index: chunks.length,
          text: chunkText,
          wordCount: currentWordCount,
          startOffset: currentStartOffset,
          endOffset: charOffset,
        });
        currentChunkParts = [paragraph];
        currentWordCount = paragraphWords;
        currentStartOffset = charOffset;
      } else {
        currentChunkParts.push(paragraph);
        currentWordCount += paragraphWords;
      }

      charOffset += paragraph.length + 2; // +2 for paragraph separator
    }

    // Flush remaining
    if (currentChunkParts.length > 0) {
      const chunkText = currentChunkParts.join('\n\n');
      chunks.push({
        index: chunks.length,
        text: chunkText,
        wordCount: currentWordCount,
        startOffset: currentStartOffset,
        endOffset: text.length,
      });
    }

    return chunks;
  }

  /**
   * Merge refined chunks back into a single text
   */
  mergeChunks(refinedChunks: string[]): string {
    return refinedChunks.join('\n\n').trim();
  }
}
