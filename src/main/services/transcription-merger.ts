import type { TranscriptionResult, TranscriptionSegment } from '../../common/types/ipc';

export interface ChunkTranscription {
  chunkIndex: number;
  startTime: number;  // chunk start time in the full audio (seconds)
  endTime: number;    // chunk end time in the full audio (seconds)
  result: TranscriptionResult;
}

/**
 * Merge multiple chunk transcription results into a single result.
 * Handles overlap deduplication and timestamp recalculation.
 */
export class TranscriptionMerger {
  private overlapSec: number;

  constructor(overlapSec: number = 3) {
    this.overlapSec = overlapSec;
  }

  /**
   * Merge chunk transcriptions into a single result
   */
  merge(chunkTranscriptions: ChunkTranscription[]): TranscriptionResult {
    if (chunkTranscriptions.length === 0) {
      return { text: '' };
    }

    if (chunkTranscriptions.length === 1) {
      return chunkTranscriptions[0].result;
    }

    // Sort by chunk index
    const sorted = [...chunkTranscriptions].sort((a, b) => a.chunkIndex - b.chunkIndex);

    const mergedTexts: string[] = [];
    const mergedSegments: TranscriptionSegment[] = [];
    let segmentIdCounter = 0;

    for (let i = 0; i < sorted.length; i++) {
      const chunk = sorted[i];
      const { result, startTime } = chunk;

      let chunkText = result.text || '';
      let chunkSegments = result.segments || [];

      // For chunks after the first, remove overlap text
      if (i > 0 && this.overlapSec > 0) {
        const prevText = mergedTexts[mergedTexts.length - 1];
        const overlapResult = this.removeOverlapText(prevText, chunkText);
        chunkText = overlapResult.trimmedText;

        // Also filter out overlap segments
        chunkSegments = chunkSegments.filter(seg => seg.start >= this.overlapSec * 0.5);
      }

      mergedTexts.push(chunkText);

      // Adjust segment timestamps with chunk offset
      for (const seg of chunkSegments) {
        mergedSegments.push({
          id: segmentIdCounter++,
          start: seg.start + startTime,
          end: seg.end + startTime,
          text: seg.text,
          speaker: seg.speaker,
        });
      }
    }

    // Join all text parts
    const fullText = mergedTexts.join(' ').replace(/\s+/g, ' ').trim();

    // Take metadata from first chunk
    const firstResult = sorted[0].result;
    const lastChunk = sorted[sorted.length - 1];

    return {
      text: fullText,
      segments: mergedSegments.length > 0 ? mergedSegments : undefined,
      language: firstResult.language,
      duration: lastChunk.endTime,
      model: firstResult.model,
      provider: firstResult.provider,
    };
  }

  /**
   * Remove overlapping text between the end of previous chunk and start of current chunk.
   * Uses a simple suffix-prefix matching approach.
   */
  private removeOverlapText(prevText: string, currentText: string): { trimmedText: string } {
    if (!prevText || !currentText) {
      return { trimmedText: currentText };
    }

    // Get the last N words from previous text (overlap zone)
    const prevWords = prevText.trim().split(/\s+/);
    const currentWords = currentText.trim().split(/\s+/);

    // Look for matching overlap in the first ~30 words of current text
    // against the last ~30 words of previous text
    const searchWindow = Math.min(30, prevWords.length, currentWords.length);

    let bestMatchLen = 0;

    for (let overlapLen = searchWindow; overlapLen >= 2; overlapLen--) {
      const prevSuffix = prevWords.slice(-overlapLen).join(' ').toLowerCase();
      const currentPrefix = currentWords.slice(0, overlapLen).join(' ').toLowerCase();

      const similarity = this.calculateSimilarity(prevSuffix, currentPrefix);
      if (similarity > 0.7) {
        bestMatchLen = overlapLen;
        break;
      }
    }

    if (bestMatchLen > 0) {
      // Remove the overlapping prefix from current text
      const trimmedWords = currentWords.slice(bestMatchLen);
      return { trimmedText: trimmedWords.join(' ') };
    }

    return { trimmedText: currentText };
  }

  /**
   * Calculate simple word-level similarity between two strings.
   * Returns a value between 0 and 1.
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);

    if (aWords.length === 0 || bWords.length === 0) return 0;

    let matches = 0;
    const maxLen = Math.max(aWords.length, bWords.length);

    for (let i = 0; i < Math.min(aWords.length, bWords.length); i++) {
      if (aWords[i] === bWords[i]) {
        matches++;
      }
    }

    return matches / maxLen;
  }
}
