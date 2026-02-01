import { globalShortcut, BrowserWindow } from 'electron';
import { setSuppressWindowShow } from './window-state';

export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
  // Ctrl+Shift+R (Cmd+Shift+R on macOS): Toggle recording
  // 녹음 시작/종료 시에는 창 표시 안 함 - 완전히 처리 완료 후에만 표시
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    console.log('[Shortcut] Recording toggle (background mode)');
    // 녹음 시작/종료 시 창 표시 억제
    setSuppressWindowShow(true);
    mainWindow.webContents.send('shortcut:recording-toggle');
    // 창 표시하지 않음 - 처리 완료 후 renderer에서 window:show 호출
  });

  // Ctrl+Shift+Q (Cmd+Shift+Q on macOS): Toggle window visibility
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ctrl+Shift+C (Cmd+Shift+C on macOS): Copy last refined text to clipboard
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    mainWindow.webContents.send('shortcut:paste-from-clipboard');
  });
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
