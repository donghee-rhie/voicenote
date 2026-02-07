import { BrowserWindow } from 'electron';
import { registerAuthHandlers } from './auth-handler';
import { registerSessionHandlers } from './session-handler';
import { registerSettingsHandlers } from './settings-handler';
import { registerTranscriptionHandlers } from './transcription-handler';
import { registerRefinementHandlers } from './refinement-handler';
import { registerSystemHandlers } from './system-handler';
import { registerAdminHandlers } from './admin-handler';
import { registerApiKeyHandlers } from './api-key-handler';
import { registerWindowHandlers } from './window-handler';
import { registerStreamingHandlers } from './streaming-handler';

/**
 * Register all IPC handlers
 * This should be called after the main window is created
 */
export function registerAllHandlers(mainWindow: BrowserWindow): void {
  // Register handlers that don't need window reference
  registerAuthHandlers();
  registerSessionHandlers();
  registerSettingsHandlers();
  registerSystemHandlers(mainWindow);
  registerAdminHandlers();
  registerApiKeyHandlers();

  // Register handlers that need window reference for events
  registerTranscriptionHandlers(mainWindow);
  registerRefinementHandlers(mainWindow);
  registerWindowHandlers(mainWindow);
  registerStreamingHandlers();

  console.log('All IPC handlers registered successfully');
}
