import { ipcMain, BrowserWindow } from 'electron';
import { refineWithGroq, isGroqRefinementConfigured } from '../services/groq-refinement-service';
import { refineText } from '../services/refinement-service';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { RefinementRequest } from '../../common/types/ipc';

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

      // Try Groq first (preferred), fallback to OpenAI
      console.log('[Refinement] Groq configured:', isGroqRefinementConfigured());
      if (isGroqRefinementConfigured()) {
        const result = await refineWithGroq(text, {
          language,
          formatType,
          refineModel: refineModel as any,
          classifierModel: classifierModel as any,
          generateSummary: true,
          generateFormal: formatType === 'FORMATTED' || formatType === 'AUTO',
        });

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
