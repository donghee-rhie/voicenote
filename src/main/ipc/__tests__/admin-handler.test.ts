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
  listUsers: vi.fn(),
  getSessionCount: vi.fn(),
  getActivityLogs: vi.fn(),
}));

import { ipcMain } from 'electron';
import { listUsers, getActivityLogs } from '../../database';
import { registerAdminHandlers } from '../admin-handler';
import { IPC_CHANNELS } from '../../../common/types/ipc';

const mockEvent = {} as Electron.IpcMainInvokeEvent;

const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash: '$2a$10$hash1',
    role: 'ADMIN',
    status: 'ACTIVE',
    language: 'ko',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastLoginAt: null,
  },
  {
    id: 'user-2',
    email: 'user@example.com',
    name: 'User',
    passwordHash: '$2a$10$hash2',
    role: 'USER',
    status: 'ACTIVE',
    language: 'ko',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastLoginAt: null,
  },
  {
    id: 'user-3',
    email: 'inactive@example.com',
    name: 'Inactive',
    passwordHash: '$2a$10$hash3',
    role: 'USER',
    status: 'INACTIVE',
    language: 'en',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    lastLoginAt: null,
  },
];

const mockActivityLogs = [
  {
    id: 'log-1',
    userId: 'user-1',
    action: 'LOGIN',
    details: 'User logged in',
    ipAddress: null,
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'log-2',
    userId: 'user-2',
    action: 'CREATE_SESSION',
    details: 'Session created',
    ipAddress: null,
    createdAt: new Date('2025-01-01'),
  },
];

describe('Admin Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(registeredHandlers).forEach((key) => delete registeredHandlers[key]);
    registerAdminHandlers();
  });

  describe('registerAdminHandlers', () => {
    it('should register all expected IPC channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.ADMIN.STATS, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.ADMIN.LOGS, expect.any(Function));
    });
  });

  describe('admin:stats', () => {
    it('should return system stats with user counts', async () => {
      vi.mocked(listUsers).mockResolvedValue(mockUsers);
      vi.mocked(getActivityLogs).mockResolvedValue(mockActivityLogs);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.STATS](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data.userCount).toBe(3);
      expect(result.data.sessionCount).toBe(0);
      expect(result.data.recentActivityCount).toBe(2);
    });

    it('should correctly count users by role', async () => {
      vi.mocked(listUsers).mockResolvedValue(mockUsers);
      vi.mocked(getActivityLogs).mockResolvedValue([]);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.STATS](mockEvent);

      expect(result.data.usersByRole).toEqual({
        ADMIN: 1,
        USER: 2,
      });
    });

    it('should correctly count users by status', async () => {
      vi.mocked(listUsers).mockResolvedValue(mockUsers);
      vi.mocked(getActivityLogs).mockResolvedValue([]);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.STATS](mockEvent);

      expect(result.data.usersByStatus).toEqual({
        ACTIVE: 2,
        INACTIVE: 1,
      });
    });

    it('should handle empty user list', async () => {
      vi.mocked(listUsers).mockResolvedValue([]);
      vi.mocked(getActivityLogs).mockResolvedValue([]);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.STATS](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data.userCount).toBe(0);
      expect(result.data.usersByRole).toEqual({});
      expect(result.data.usersByStatus).toEqual({});
      expect(result.data.recentActivityCount).toBe(0);
    });

    it('should handle database error', async () => {
      vi.mocked(listUsers).mockRejectedValue(new Error('DB connection failed'));

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.STATS](mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection failed');
    });
  });

  describe('admin:logs', () => {
    it('should return activity logs without filter', async () => {
      vi.mocked(getActivityLogs).mockResolvedValue(mockActivityLogs);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.LOGS](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(getActivityLogs).toHaveBeenCalledWith(undefined);
    });

    it('should pass filter to getActivityLogs', async () => {
      vi.mocked(getActivityLogs).mockResolvedValue([mockActivityLogs[0]]);

      const filter = { userId: 'user-1', limit: 50 };
      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.LOGS](mockEvent, filter);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(getActivityLogs).toHaveBeenCalledWith(filter);
    });

    it('should return empty array when no logs exist', async () => {
      vi.mocked(getActivityLogs).mockResolvedValue([]);

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.LOGS](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      vi.mocked(getActivityLogs).mockRejectedValue(new Error('Log query failed'));

      const result = await registeredHandlers[IPC_CHANNELS.ADMIN.LOGS](mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Log query failed');
    });
  });
});
