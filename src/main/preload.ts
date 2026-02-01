import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_CHANNELS = [
  // 오디오
  'audio:start-recording',
  'audio:stop-recording',
  'audio:recording-state',
  'audio:save-blob',
  // STT 변환
  'transcription:start',
  'transcription:progress',
  'transcription:complete',
  'transcription:error',
  // 텍스트 정제
  'refinement:start',
  'refinement:complete',
  'refinement:error',
  // 세션
  'session:create',
  'session:update',
  'session:delete',
  'session:get',
  'session:list',
  'session:search',
  // 사용자
  'user:login',
  'user:list',
  'user:update',
  'user:delete',
  'user:create',
  // 설정
  'settings:get',
  'settings:update',
  'settings:system-get',
  'settings:system-update',
  // API 키
  'api-key:get',
  'api-key:set',
  'api-key:delete',
  'api-key:validate',
  // 관리자
  'admin:stats',
  'admin:logs',
  // 시스템
  'system:get-version',
  'system:open-external',
  'system:clipboard-copy',
  'system:export-session',
  'system:show-save-dialog',
  'system:auto-start-get',
  'system:auto-start-set',
  'system:show-notification',
  'system:auto-paste',
  'window:show',
  'window:hide',
  'window:set-suppress',
  // 워크플로우
  'workflow:status',
  'workflow:complete',
  'workflow:error',
  // 단축키
  'shortcut:recording-toggle',
  'shortcut:paste-from-clipboard',
  // 네비게이션
  'nav:settings',
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`IPC channel not allowed: ${channel}`);
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`IPC channel not allowed: ${channel}`);
  },

  send: (channel: string, ...args: any[]) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
});
