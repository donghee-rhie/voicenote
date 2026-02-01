import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts';
import { createTray } from './tray';
import { registerAllHandlers } from './ipc';
import { initAutoUpdater } from './updater';
import { getSuppressWindowShow } from './window-state';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

// ---- Single instance lock ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[App] Another instance detected -> quitting');
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _workingDirectory) => {
    // IMPORTANT: Do NOT show window here (prevents phantom blank window from second instance)
    console.log('[App] second-instance event (ignored: no window show)');
  });
}

// ---- Instrumentation (dev) ----
function instrumentWindow(win: BrowserWindow, label: string) {
  const id = win.id;
  const pid = process.pid;
  const getUrl = () => {
    try {
      return win.webContents.getURL();
    } catch {
      return '(no-url)';
    }
  };
  const log = (msg: string) => {
    console.log(`[Win][${label}][id=${id}][pid=${pid}] ${msg} url=${getUrl()} suppress=${getSuppressWindowShow()}`);
  };

  win.on('ready-to-show', () => log('event=ready-to-show'));
  win.on('show', () => log('event=show'));
  win.on('focus', () => log('event=focus'));
  win.on('blur', () => log('event=blur'));
  win.on('hide', () => log('event=hide'));
  win.on('closed', () => log('event=closed'));
  win.webContents.on('did-start-loading', () => log('wc=did-start-loading'));
  win.webContents.on('did-finish-load', () => log('wc=did-finish-load'));
}

function installShowMonkeyPatch() {
  // If something calls show() unexpectedly, log stack
  const proto: any = (BrowserWindow as any).prototype;
  const originalShow = proto.show;
  const originalFocus = proto.focus;

  if (!originalShow || (proto as any).__showMonkeyPatched) return;
  (proto as any).__showMonkeyPatched = true;

  proto.show = function (...args: any[]) {
    const stack = new Error().stack;
    console.log(`[Win][MonkeyPatch] BrowserWindow.show() called id=${this?.id} suppress=${getSuppressWindowShow()}\n${stack}`);
    // Hard guard: if suppression is active, immediately hide and do not bring to front
    if (getSuppressWindowShow()) {
      try {
        originalShow.apply(this, args);
        this.hide?.();
      } catch {
        // ignore
      }
      return;
    }
    return originalShow.apply(this, args);
  };

  proto.focus = function (...args: any[]) {
    const stack = new Error().stack;
    console.log(`[Win][MonkeyPatch] BrowserWindow.focus() called id=${this?.id} suppress=${getSuppressWindowShow()}\n${stack}`);
    // suppress 활성 시 focus도 차단
    if (getSuppressWindowShow()) {
      console.log('[Win][MonkeyPatch] focus() blocked - suppress active');
      return;
    }
    return originalFocus.apply(this, args);
  };
}

if (isDev) {
  installShowMonkeyPatch();

  app.on('browser-window-created', (_event, win) => {
    try {
      instrumentWindow(win, 'created');
      console.log(`[App] browser-window-created id=${win.id} pid=${process.pid} url=${win.webContents.getURL?.()}`);
    } catch (e) {
      console.log('[App] browser-window-created (instrument failed)', e);
    }
  });
}

app.on('ready', async () => {
  console.log('[App] Ready event fired. isPackaged:', app.isPackaged);

  // 데이터베이스 초기화 (프로덕션: 마이그레이션 실행)
  try {
    console.log('[App] Initializing database...');
    const { initializeDatabase } = require('./database');
    await initializeDatabase();
    console.log('[App] Database initialized.');
  } catch (err) {
    console.error('[App] Failed to initialize database:', err);
  }

  // 기본 로컬 사용자 생성 (로그인 없이 사용)
  try {
    console.log('[App] Creating local user...');
    const { getOrCreateLocalUser } = require('./database');
    await getOrCreateLocalUser();
    console.log('[App] Local user ready.');
  } catch (err) {
    console.error('[App] Failed to create local user:', err);
  }

  console.log('[App] Creating main window...');
  mainWindow = createMainWindow();
  if (isDev && mainWindow) instrumentWindow(mainWindow, 'main');

  // Register IPC handlers
  registerAllHandlers(mainWindow);

  registerGlobalShortcuts(mainWindow);
  createTray(mainWindow);

  // Initialize auto-updater in production only
  if (app.isPackaged) {
    initAutoUpdater();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Dock 클릭 시 창 표시
app.on('activate', () => {
  console.log(`[App] Activate event - suppress=${getSuppressWindowShow()}`);
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  } else if (mainWindow) {
    // Dock 클릭은 사용자 의도이므로 suppress 해제 후 창 표시
    const { setSuppressWindowShow } = require('./window-state');
    setSuppressWindowShow(false);
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});
