import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_CHECK_DELAY_MS = 10 * 1000; // 10 seconds after app ready

function log(message: string): void {
  console.log(`[AutoUpdater] ${message}`);
}

export function initAutoUpdater(): void {
  // Disable auto-download so the user can decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // --- Event handlers ---

  autoUpdater.on('checking-for-update', () => {
    log('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log(`Update available: v${info.version}`);

    const focusedWindow = BrowserWindow.getFocusedWindow();
    dialog
      .showMessageBox({
        ...(focusedWindow ? { parentWindow: focusedWindow } : {}),
        type: 'info',
        title: 'Update Available',
        message: `A new version (v${info.version}) is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          log('User chose to download update.');
          autoUpdater.downloadUpdate();
        } else {
          log('User deferred update download.');
        }
      });
  });

  autoUpdater.on('update-not-available', () => {
    log('No updates available.');
  });

  autoUpdater.on('download-progress', (progress) => {
    log(
      `Download progress: ${progress.percent.toFixed(1)}% ` +
        `(${(progress.transferred / 1024 / 1024).toFixed(1)}MB / ${(progress.total / 1024 / 1024).toFixed(1)}MB)`
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(`Update downloaded: v${info.version}`);

    const focusedWindow = BrowserWindow.getFocusedWindow();
    dialog
      .showMessageBox({
        ...(focusedWindow ? { parentWindow: focusedWindow } : {}),
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'The update will be installed when you restart the application. Restart now?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          log('User chose to restart and install update.');
          autoUpdater.quitAndInstall();
        } else {
          log('User deferred update installation. Will install on next restart.');
        }
      });
  });

  autoUpdater.on('error', (error) => {
    log(`Update error: ${error.message}`);
    console.error('[AutoUpdater] Error details:', error);
  });

  // --- Schedule update checks ---

  // Initial check after a short delay (let the app finish starting)
  setTimeout(() => {
    log('Performing initial update check.');
    autoUpdater.checkForUpdates().catch((err) => {
      log(`Initial update check failed: ${err.message}`);
    });
  }, INITIAL_CHECK_DELAY_MS);

  // Periodic check every 4 hours
  setInterval(() => {
    log('Performing scheduled update check.');
    autoUpdater.checkForUpdates().catch((err) => {
      log(`Scheduled update check failed: ${err.message}`);
    });
  }, UPDATE_CHECK_INTERVAL_MS);

  log('Auto-updater initialized.');
}
