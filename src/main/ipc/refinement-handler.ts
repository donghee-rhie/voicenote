import { ipcMain, BrowserWindow } from 'electron';
import { refineWithGroq, isGroqRefinementConfigured } from '../services/groq-refinement-service';
import { refineText } from '../services/refinement-service';
import { TextChunker, countWords } from '../services/text-chunker';
import { generateSummary } from '../services/summary-service';
import { withRetry } from '../services/retry-handler';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { RefinementRequest, RefinementResult, ProcessingProgress } from '../../common/types/ipc';

const textChunker = new TextChunker();

/**
 * Send refinement progress to renderer
 */
function sendRefinementProgress(mainWindow: BrowserWindow, progress: ProcessingProgress) {
  mainWindow.webContents.send(IPC_CHANNELS.REFINEMENT.REFINEMENT_PROGRESS, progress);
}

/**
 * Register refinement-related IPC handlers
 */
export function registerRefinementHandlers(mainWindow: BrowserWindow) {
  // Start refinement
  ipcMain.handle(IPC_CHANNELS.REFINEMENT.START, async (_event, request: RefinementRequest) => {
    try {
      const { text, formatType, language, refineModel, classifierModel } = request;

      console.log('[Refinement] Starting refinement, text length:', text?.length, 'formatType:', formatType);

      if (!text || text.trim().length === 0) {
        console.log('[Refinement] Error: Text is required');
        return {
          success: false,
          error: 'Text is required',
        };
      }

      const wordCount = countWords(text);
      console.log('[Refinement] Word count:', wordCount);

      // Check if text needs chunking (>2000 words)
      if (textChunker.needsChunking(text)) {
        console.log('[Refinement] Long text detected, using chunked refinement');
        const result = await handleChunkedRefinement(
          mainWindow, text, { formatType, language, refineModel, classifierModel }
        );

        mainWindow.webContents.send(IPC_CHANNELS.REFINEMENT.COMPLETE, result);
        return { success: true, data: result };
      }

      // Short text - standard refinement
      // Try Groq first (preferred), fallback to OpenAI
      console.log('[Refinement] Groq configured:', isGroqRefinementConfigured());
      if (isGroqRefinementConfigured()) {
        const retryResult = await withRetry(() => refineWithGroq(text, {
          language,
          formatType,
          refineModel: refineModel as any,
          classifierModel: classifierModel as any,
          generateSummary: true,
          generateFormal: formatType === 'FORMATTED' || formatType === 'AUTO',
        }));

        if (!retryResult.success || !retryResult.data) {
          throw retryResult.error || new Error('Refinement failed after retries');
        }

        const result = retryResult.data;

        console.log('[Refinement] Groq result:', {
          text: result.text?.substring(0, 50),
          formalText: result.formalText?.substring(0, 50),
          summary: result.summary?.substring(0, 50)
        });

        // Emit complete event
        mainWindow.webContents.send(IPC_CHANNELS.REFINEMENT.COMPLETE, result);

        return {
          success: true,
          data: result,
        };
      }

      // Fallback to OpenAI refinement service
      const result = await refineText(text, {
        format: formatType,
        generateSummary: true,
        model: 'gpt-4o-mini',
      });

      // Emit complete event
      mainWindow.webContents.send(IPC_CHANNELS.REFINEMENT.COMPLETE, result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Refinement error:', error);

      // Emit error event
      const errorMessage = error instanceof Error ? error.message : 'Refinement failed';
      mainWindow.webContents.send(IPC_CHANNELS.REFINEMENT.ERROR, {
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  });
}

/**
 * Handle chunked refinement for long text
 */
async function handleChunkedRefinement(
  mainWindow: BrowserWindow,
  text: string,
  options: { formatType?: string; language?: string; refineModel?: string; classifierModel?: string }
): Promise<RefinementResult> {
  const { formatType, language, refineModel, classifierModel } = options;
  const chunks = textChunker.chunkText(text);
  const totalChunks = chunks.length;

  console.log(`[Refinement] Split into ${totalChunks} text chunks`);

  const refinedChunks: string[] = [];
  const formalChunks: string[] = [];
  let chunkErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const elapsed = Date.now() - startTime;
    const avgTime = i > 0 ? elapsed / i : 0;
    const estimatedRemaining = avgTime * (totalChunks - i);

    sendRefinementProgress(mainWindow, {
      stage: 'refining',
      stageLabel: `텍스트 정제 중... (${i + 1}/${totalChunks})`,
      currentChunk: i + 1,
      totalChunks,
      overallProgress: Math.round(((i / totalChunks) * 80) + 10),
      estimatedRemainingMs: Math.round(estimatedRemaining),
      chunkResults: refinedChunks.length,
      chunkErrors,
    });

    console.log(`[Refinement] Processing chunk ${i + 1}/${totalChunks} (${chunk.wordCount} words)`);

    const retryResult = await withRetry(() => refineWithGroq(chunk.text, {
      language,
      formatType,
      refineModel: refineModel as any,
      classifierModel: classifierModel as any,
      generateSummary: false,
      generateFormal: formatType === 'FORMATTED' || formatType === 'AUTO',
    }));

    if (retryResult.success && retryResult.data) {
      refinedChunks.push(retryResult.data.text);
      if (retryResult.data.formalText) {
        formalChunks.push(retryResult.data.formalText);
      }
    } else {
      chunkErrors++;
      console.error(`[Refinement] Chunk ${i + 1} failed:`, retryResult.error?.message);
      // Use original text for failed chunks
      refinedChunks.push(chunk.text);
    }
  }

  // Merge refined chunks
  const mergedRefinedText = textChunker.mergeChunks(refinedChunks);
  const mergedFormalText = formalChunks.length > 0 ? textChunker.mergeChunks(formalChunks) : undefined;

  // Generate summary from the merged text
  sendRefinementProgress(mainWindow, {
    stage: 'summarizing',
    stageLabel: '요약 생성 중...',
    currentChunk: totalChunks,
    totalChunks,
    overallProgress: 92,
    chunkResults: refinedChunks.length,
    chunkErrors,
  });

  let summary: string | undefined;
  try {
    const textForSummary = mergedFormalText || mergedRefinedText;
    summary = await generateSummary(textForSummary, {
      language,
      model: refineModel,
    });
  } catch (err) {
    console.error('[Refinement] Summary generation failed:', err);
  }

  sendRefinementProgress(mainWindow, {
    stage: 'summarizing',
    stageLabel: '정제 완료',
    currentChunk: totalChunks,
    totalChunks,
    overallProgress: 100,
    chunkResults: refinedChunks.length,
    chunkErrors,
  });

  return {
    text: mergedRefinedText,
    formalText: mergedFormalText,
    summary,
    modelsUsed: {
      refine: refineModel || 'openai/gpt-oss-120b',
    },
  };
}
