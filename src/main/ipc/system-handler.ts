import { ipcMain, shell, clipboard, dialog, app, Notification, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { getSessionById } from '../database';
import { IPC_CHANNELS } from '../../common/types/ipc';
import { exportAsText, exportAsMarkdown, exportAsJSON } from '../services/export-service';

// Package.json for version info
const packageJson = require(path.join(__dirname, '..', '..', '..', '..', 'package.json'));

/**
 * Register system-related IPC handlers
 */
export function registerSystemHandlers(mainWindow: BrowserWindow) {
  // Get app version
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_VERSION, async () => {
    try {
      return {
        success: true,
        data: {
          version: packageJson.version,
          name: packageJson.name,
          description: packageJson.description,
        },
      };
    } catch (error) {
      console.error('Get version error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get version',
      };
    }
  });

  // Open external URL
  ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_EXTERNAL, async (_event, url: string) => {
    try {
      if (!url) {
        return {
          success: false,
          error: 'URL is required',
        };
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return {
          success: false,
          error: 'Invalid URL',
        };
      }

      await shell.openExternal(url);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Open external error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open URL',
      };
    }
  });

  // Copy to clipboard
  ipcMain.handle(IPC_CHANNELS.SYSTEM.CLIPBOARD_COPY, async (_event, text: string) => {
    try {
      if (text === undefined || text === null) {
        return {
          success: false,
          error: 'Text is required',
        };
      }

      clipboard.writeText(text);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Clipboard copy error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy to clipboard',
      };
    }
  });

  // Show save dialog
  ipcMain.handle(IPC_CHANNELS.SYSTEM.SHOW_SAVE_DIALOG, async (_event, options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => {
    try {
      const result = await dialog.showSaveDialog({
        title: options?.title || 'Save File',
        defaultPath: options?.defaultPath,
        filters: options?.filters || [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled) {
        return {
          success: false,
          canceled: true,
        };
      }

      return {
        success: true,
        data: { filePath: result.filePath },
      };
    } catch (error) {
      console.error('Show save dialog error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show save dialog',
      };
    }
  });

  // Export session
  ipcMain.handle(IPC_CHANNELS.SYSTEM.EXPORT_SESSION, async (_event, params: { sessionId: string; format: 'text' | 'markdown' | 'json' }) => {
    try {
      const { sessionId, format } = params;

      if (!sessionId) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      if (!format || !['text', 'markdown', 'json'].includes(format)) {
        return {
          success: false,
          error: 'Invalid format specified',
        };
      }

      // Get session from database
      const session = await getSessionById(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      // Generate export content using export service
      let content: string;
      let extension: string;
      let filterName: string;

      switch (format) {
        case 'markdown':
          content = exportAsMarkdown(session);
          extension = 'md';
          filterName = 'Markdown Files';
          break;
        case 'json':
          content = exportAsJSON(session);
          extension = 'json';
          filterName = 'JSON Files';
          break;
        case 'text':
        default:
          content = exportAsText(session);
          extension = 'txt';
          filterName = 'Text Files';
          break;
      }

      // Show save dialog with appropriate file extension filter
      const sanitizedTitle = (session.title || 'untitled').replace(/[^a-z0-9]/gi, '_');
      const defaultFilename = `session-${sanitizedTitle}-${Date.now()}.${extension}`;

      const result = await dialog.showSaveDialog({
        title: 'Export Session',
        defaultPath: path.join(app.getPath('documents'), defaultFilename),
        filters: [
          { name: filterName, extensions: [extension] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
        };
      }

      // Write file to selected path using fs
      fs.writeFileSync(result.filePath, content, 'utf-8');

      return {
        success: true,
        data: { filePath: result.filePath },
      };
    } catch (error) {
      console.error('Export session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export session',
      };
    }
  });

  // Get auto-start status
  ipcMain.handle(IPC_CHANNELS.SYSTEM.AUTO_START_GET, async () => {
    try {
      const loginItemSettings = app.getLoginItemSettings();

      return {
        success: true,
        data: {
          openAtLogin: loginItemSettings.openAtLogin,
          openAsHidden: loginItemSettings.openAsHidden,
        },
      };
    } catch (error) {
      console.error('Get auto-start error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auto-start status',
      };
    }
  });

  // Set auto-start
  ipcMain.handle(IPC_CHANNELS.SYSTEM.AUTO_START_SET, async (_event, enabled: boolean, openAsHidden: boolean = false) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden,
      });

      return {
        success: true,
        data: {
          openAtLogin: enabled,
          openAsHidden,
        },
      };
    } catch (error) {
      console.error('Set auto-start error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set auto-start',
      };
    }
  });

  // Auto paste (simulate Cmd+V / Ctrl+V)
  ipcMain.handle('system:auto-paste', async () => {
    try {
      console.log('[AutoPaste] Simulating paste keystroke');
      if (process.platform === 'darwin') {
        const { exec } = require('child_process');
        // AppleScript로 Cmd+V 시뮬레이션
        await new Promise<void>((resolve, reject) => {
          exec(
            `osascript -e 'tell application "System Events" to keystroke "v" using command down'`,
            (err: any) => {
              if (err) {
                console.error('[AutoPaste] osascript error:', err);
                reject(err);
              } else {
                console.log('[AutoPaste] Paste simulated successfully');
                resolve();
              }
            }
          );
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Auto paste error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to auto paste',
      };
    }
  });

  // Show system notification
  ipcMain.handle('system:show-notification', async (_event, { title, body }: { title: string; body?: string }) => {
    try {
      console.log(`[Notification] Showing: "${title}" - "${body}"`);
      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body: body || '',
          silent: false,
        });
        // 알림 클릭 시 앱 창 표시
        notification.on('click', () => {
          console.log('[Notification] Clicked - showing app window');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
        notification.show();
      }
      return { success: true };
    } catch (error) {
      console.error('Show notification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show notification',
      };
    }
  });
}
