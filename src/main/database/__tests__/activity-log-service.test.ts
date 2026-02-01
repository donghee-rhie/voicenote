import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockActivityLog = {
  create: vi.fn(),
  findMany: vi.fn(),
};

vi.mock('../client', () => ({
  getDatabase: () => ({
    activityLog: mockActivityLog,
  }),
}));

import { logActivity, getActivityLogs } from '../services/activity-log-service';

const sampleLog = {
  id: 'log-1',
  userId: 'user-1',
  action: 'LOGIN',
  details: 'User logged in',
  ipAddress: '127.0.0.1',
  createdAt: new Date('2025-01-01'),
};

describe('activity-log-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logActivity', () => {
    it('should create an activity log with all fields', async () => {
      mockActivityLog.create.mockResolvedValue(sampleLog);

      const result = await logActivity({
        userId: 'user-1',
        action: 'LOGIN',
        details: 'User logged in',
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(sampleLog);
      expect(mockActivityLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'LOGIN',
          details: 'User logged in',
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('should create an activity log with only required fields', async () => {
      const minimalLog = { ...sampleLog, userId: undefined, details: undefined, ipAddress: undefined };
      mockActivityLog.create.mockResolvedValue(minimalLog);

      await logActivity({ action: 'SYSTEM_START' });

      expect(mockActivityLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'SYSTEM_START',
          details: undefined,
          ipAddress: undefined,
        },
      });
    });

    it('should throw on error', async () => {
      mockActivityLog.create.mockRejectedValue(new Error('DB error'));

      await expect(logActivity({ action: 'TEST' })).rejects.toThrow(
        'Failed to log activity: DB error'
      );
    });

    it('should throw unknown error for non-Error objects', async () => {
      mockActivityLog.create.mockRejectedValue(false);

      await expect(logActivity({ action: 'TEST' })).rejects.toThrow(
        'Failed to log activity: Unknown error'
      );
    });
  });

  describe('getActivityLogs', () => {
    it('should return logs with default pagination and no filters', async () => {
      mockActivityLog.findMany.mockResolvedValue([sampleLog]);

      const result = await getActivityLogs();

      expect(result).toEqual([sampleLog]);
      expect(mockActivityLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
    });

    it('should filter by userId', async () => {
      mockActivityLog.findMany.mockResolvedValue([sampleLog]);

      await getActivityLogs({ userId: 'user-1' });

      const callArgs = mockActivityLog.findMany.mock.calls[0][0];
      expect(callArgs.where.userId).toBe('user-1');
    });

    it('should filter by action', async () => {
      mockActivityLog.findMany.mockResolvedValue([]);

      await getActivityLogs({ action: 'LOGIN' });

      const callArgs = mockActivityLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action).toBe('LOGIN');
    });

    it('should apply both userId and action filters', async () => {
      mockActivityLog.findMany.mockResolvedValue([]);

      await getActivityLogs({ userId: 'user-1', action: 'LOGIN' });

      const callArgs = mockActivityLog.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ userId: 'user-1', action: 'LOGIN' });
    });

    it('should apply custom pagination', async () => {
      mockActivityLog.findMany.mockResolvedValue([]);

      await getActivityLogs({ page: 2, limit: 10 });

      const callArgs = mockActivityLog.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });

    it('should handle page 1 with custom limit', async () => {
      mockActivityLog.findMany.mockResolvedValue([]);

      await getActivityLogs({ page: 1, limit: 25 });

      const callArgs = mockActivityLog.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(0);
      expect(callArgs.take).toBe(25);
    });

    it('should throw on error', async () => {
      mockActivityLog.findMany.mockRejectedValue(new Error('DB error'));

      await expect(getActivityLogs()).rejects.toThrow('Failed to get activity logs: DB error');
    });

    it('should throw unknown error for non-Error objects', async () => {
      mockActivityLog.findMany.mockRejectedValue(0);

      await expect(getActivityLogs()).rejects.toThrow(
        'Failed to get activity logs: Unknown error'
      );
    });
  });
});
