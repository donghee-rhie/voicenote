import { ipcMain, BrowserWindow } from 'electron';
import { setSuppressWindowShow } from '../window-state';

/**
 * Register window-related IPC handlers
 */
export function registerWindowHandlers(mainWindow: BrowserWindow): void {
  // Show window (녹음 완료 후에만 호출됨)
  ipcMain.handle('window:show', async () => {
    try {
      // 녹음 완료 후에는 suppression 해제
      setSuppressWindowShow(false);
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      console.log('[Window] Window shown and focused (recording complete)');
      return { success: true };
    } catch (error) {
      console.error('Window show error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show window',
      };
    }
  });

  // Suppress window show (recording start)
  ipcMain.handle('window:set-suppress', async (_event, suppress: boolean) => {
    try {
      setSuppressWindowShow(!!suppress);
      return { success: true, data: { suppress: !!suppress } };
    } catch (error) {
      console.error('Window suppress error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set suppress',
      };
    }
  });

  // Hide window
  ipcMain.handle('window:hide', async () => {
    try {
      mainWindow.hide();
      console.log('[Window] Window hidden');
      return { success: true };
    } catch (error) {
      console.error('Window hide error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to hide window',
      };
    }
  });
}
