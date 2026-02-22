import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { LLMProvider } from '../../common/types/ipc';
import { fetchModels } from '../services/model-fetching-service';

/**
 * Register model fetching IPC handlers
 */
export function registerModelFetchingHandlers() {
  ipcMain.handle(IPC_CHANNELS.MODELS.FETCH, async (_event, request: { provider: LLMProvider }) => {
    try {
      const { provider } = request;

      if (!provider || !['groq', 'fireworks', 'openai', 'anthropic'].includes(provider)) {
        return { success: false, error: 'Invalid provider' };
      }

      const result = await fetchModels(provider);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('[ModelFetching] Handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models',
      };
    }
  });
}
