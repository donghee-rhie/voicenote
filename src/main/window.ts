import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { getSuppressWindowShow } from './window-state';

const isDev = !app.isPackaged;

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'VoiceNote',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    if (!getSuppressWindowShow()) {
      mainWindow.show();
    } else {
      console.log('[Window] ready-to-show suppressed');
    }
  });

  // If a window is shown while suppressed, immediately hide it
  mainWindow.on('show', () => {
    if (getSuppressWindowShow()) {
      console.log('[Window] show suppressed - hiding window');
      mainWindow.hide();
    }
  });

  // 창 닫기 시 숨기기 (트레이에 유지)
  mainWindow.on('close', (event) => {
    if (!(mainWindow as any).forceClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // renderer에서 window.open() 등으로 새 창 생성 시도 시 차단
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[Window] Blocked new window creation attempt: ${url}`);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const htmlPath = path.join(__dirname, '../../renderer/index.html');
    console.log('[Window] Loading file:', htmlPath);
    mainWindow.loadFile(htmlPath).catch((err) => {
      console.error('[Window] Failed to load file:', err);
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Window] did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] did-finish-load: URL =', mainWindow.webContents.getURL());
  });

  return mainWindow;
}
