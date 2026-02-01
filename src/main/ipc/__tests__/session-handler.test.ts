import { vi, describe, it, expect, beforeEach } from 'vitest';

// Capture registered IPC handlers
const registeredHandlers: Record<string, Function> = {};

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      registeredHandlers[channel] = handler;
    }),
  },
}));

vi.mock('../../database', () => ({
  createSession: vi.fn(),
  getSessionById: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn(),
}));

import { ipcMain } from 'electron';
import {
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  listSessions,
} from '../../database';
import { registerSessionHandlers } from '../session-handler';
import { IPC_CHANNELS } from '../../../common/types/ipc';

const mockEvent = {} as Electron.IpcMainInvokeEvent;

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  title: 'Test Session',
  description: null,
  originalText: 'Raw transcription text',
  refinedText: 'Refined text',
  summary: 'Summary',
  audioPath: '/path/to/audio.wav',
  duration: 3600,
  language: 'ko-KR',
  provider: null,
  model: null,
  formatType: 'MINUTES',
  status: 'COMPLETED',
  tags: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('Session Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(registeredHandlers).forEach((key) => delete registeredHandlers[key]);
    registerSessionHandlers();
  });

  describe('registerSessionHandlers', () => {
    it('should register all expected IPC channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.CREATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.GET, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.UPDATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.DELETE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.LIST, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.SESSION.SEARCH, expect.any(Function));
    });
  });

  describe('session:create', () => {
    it('should create a session with valid data', async () => {
      vi.mocked(createSession).mockResolvedValue(mockSession);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.CREATE](mockEvent, {
        userId: 'user-1',
        title: 'Test Session',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(createSession).toHaveBeenCalledWith({ userId: 'user-1', title: 'Test Session' });
    });

    it('should fail when userId is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.CREATE](mockEvent, {
        title: 'Test Session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(createSession).mockRejectedValue(new Error('DB write failed'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.CREATE](mockEvent, {
        userId: 'user-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB write failed');
    });
  });

  describe('session:get', () => {
    it('should return session by id', async () => {
      vi.mocked(getSessionById).mockResolvedValue(mockSession);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.GET](mockEvent, 'session-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
    });

    it('should fail when session is not found', async () => {
      vi.mocked(getSessionById).mockResolvedValue(null);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.GET](mockEvent, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should fail when session ID is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.GET](mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(getSessionById).mockRejectedValue(new Error('DB read failed'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.GET](mockEvent, 'session-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB read failed');
    });
  });

  describe('session:update', () => {
    it('should update session with valid data', async () => {
      const updatedSession = { ...mockSession, title: 'Updated Title' };
      vi.mocked(updateSession).mockResolvedValue(updatedSession);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.UPDATE](mockEvent, 'session-1', {
        title: 'Updated Title',
      });

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Updated Title');
      expect(updateSession).toHaveBeenCalledWith('session-1', { title: 'Updated Title' });
    });

    it('should fail when session ID is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.UPDATE](mockEvent, '', {
        title: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(updateSession).mockRejectedValue(new Error('Session not found'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.UPDATE](mockEvent, 'session-999', {
        title: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('session:delete', () => {
    it('should delete session by id', async () => {
      vi.mocked(deleteSession).mockResolvedValue(mockSession);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.DELETE](mockEvent, 'session-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
      expect(deleteSession).toHaveBeenCalledWith('session-1');
    });

    it('should fail when session ID is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.DELETE](mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(deleteSession).mockRejectedValue(new Error('Cannot delete session'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.DELETE](mockEvent, 'session-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete session');
    });
  });

  describe('session:list', () => {
    it('should list sessions with userId filter', async () => {
      vi.mocked(listSessions).mockResolvedValue([mockSession]);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, {
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(listSessions).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('should pass status and search filters to database', async () => {
      vi.mocked(listSessions).mockResolvedValue([]);

      await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, {
        userId: 'user-1',
        status: 'COMPLETED',
        search: 'test query',
      });

      expect(listSessions).toHaveBeenCalledWith({
        userId: 'user-1',
        status: 'COMPLETED',
        search: 'test query',
      });
    });

    it('should convert offset to page number', async () => {
      vi.mocked(listSessions).mockResolvedValue([]);

      await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, {
        userId: 'user-1',
        limit: 10,
        offset: 20,
      });

      expect(listSessions).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: 10,
        page: 3,
      });
    });

    it('should fail when userId is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should fail when filter is undefined', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, undefined);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(listSessions).mockRejectedValue(new Error('DB error'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.LIST](mockEvent, {
        userId: 'user-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('session:search', () => {
    it('should search sessions with filters', async () => {
      vi.mocked(listSessions).mockResolvedValue([mockSession]);

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.SEARCH](mockEvent, {
        userId: 'user-1',
        search: 'test keyword',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(listSessions).toHaveBeenCalledWith({
        userId: 'user-1',
        search: 'test keyword',
      });
    });

    it('should fail when userId is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.SESSION.SEARCH](mockEvent, {
        search: 'keyword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error', async () => {
      vi.mocked(listSessions).mockRejectedValue(new Error('Search failed'));

      const result = await registeredHandlers[IPC_CHANNELS.SESSION.SEARCH](mockEvent, {
        userId: 'user-1',
        search: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
    });
  });
});
