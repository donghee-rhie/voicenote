import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';
import { setSuppressWindowShow } from './window-state';

let tray: Tray | null = null;

// 16x16 마이크 아이콘 생성 (Base64 PNG)
function createTrayIcon(): Electron.NativeImage {
  // 간단한 16x16 마이크 모양 아이콘 (흰색 배경, 검정 마이크)
  const iconDataUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMS41ZEdYUgAAAQFJREFUOE+tk80KwjAQhHuRih48ePHgwYsX8eDFi6/g+/8PEP+KJ0WtmMqOZmtSbdODB4ZkN5NJdpPw81JVVZ0kSUaO4zweWJalmTxJB0A8xhI7xHFcs9ZGaZrWgyA4c0kiwOOxPYLxkziKIn/xNJ1AkLxSICnfgSVJgtN4BIq9LMtc+04HKMoEkqy2nSqAJIt5gCQLdkDuIJbQ7TYSILLUbQI0mECiH4qLPEDTNM4EkiyMBZIsQl/pD9bAkKJtMQES20kEmEygVzeAJItkh+QNBQW2fgwk27YVBRlAkgW7dAAtAlRVhWEf+74fuq5rAbB8MQCg1/KXt/2HJP9B+ANvvQ7bOPgD3AAAAABJRU5ErkJggg==`;
  
  const icon = nativeImage.createFromDataURL(iconDataUrl);
  // macOS 트레이 아이콘은 template 이미지로 설정해야 시스템 테마에 맞게 표시됨
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = createTrayIcon();

  tray = new Tray(icon);
  tray.setToolTip('VoiceNote');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '창 보이기',
      click: () => {
        setSuppressWindowShow(false); // suppress 해제
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '녹음 시작/중지',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: () => {
        console.log('[Tray] Recording toggle triggered (background)');
        // 녹음 시작/종료 시 창 표시 억제
        setSuppressWindowShow(true);
        mainWindow.webContents.send('shortcut:recording-toggle');
        // 창 표시하지 않음 - 처리 완료 후 renderer에서 window:show 호출
      },
    },
    { type: 'separator' },
    {
      label: '설정',
      click: () => {
        setSuppressWindowShow(false); // suppress 해제
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('nav:settings');
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        (mainWindow as any).forceClose = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      setSuppressWindowShow(false); // suppress 해제
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
