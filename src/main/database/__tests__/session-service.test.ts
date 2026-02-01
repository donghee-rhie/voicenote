import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockSession = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

vi.mock('../client', () => ({
  getDatabase: () => ({
    session: mockSession,
  }),
}));

import {
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  listSessions,
  getSessionCount,
} from '../services/session-service';

const sampleSession = {
  id: 'session-1',
  userId: 'user-1',
  title: 'Test Session',
  description: 'A test session',
  originalText: null,
  refinedText: null,
  summary: null,
  audioPath: null,
  duration: null,
  language: 'ko-KR',
  provider: null,
  model: null,
  formatType: 'DEFAULT',
  status: 'DRAFT',
  tags: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('session-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with default values', async () => {
      mockSession.create.mockResolvedValue(sampleSession);

      const result = await createSession({ userId: 'user-1', title: 'Test Session' });

      expect(result).toEqual(sampleSession);
      expect(mockSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Test Session',
          description: undefined,
          language: 'ko-KR',
          provider: undefined,
          model: undefined,
          formatType: 'DEFAULT',
          status: 'DRAFT',
        },
      });
    });

    it('should create a session with custom values', async () => {
      mockSession.create.mockResolvedValue({ ...sampleSession, language: 'en-US' });

      await createSession({
        userId: 'user-1',
        title: 'Custom',
        language: 'en-US',
        provider: 'whisper',
        model: 'large-v3',
        formatType: 'MEETING',
      });

      expect(mockSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          title: 'Custom',
          description: undefined,
          language: 'en-US',
          provider: 'whisper',
          model: 'large-v3',
          formatType: 'MEETING',
          status: 'DRAFT',
        },
      });
    });

    it('should throw on error', async () => {
      mockSession.create.mockRejectedValue(new Error('FK violation'));

      await expect(createSession({ userId: 'bad' })).rejects.toThrow(
        'Failed to create session: FK violation'
      );
    });

    it('should throw unknown error for non-Error objects', async () => {
      mockSession.create.mockRejectedValue(null);

      await expect(createSession({ userId: 'x' })).rejects.toThrow(
        'Failed to create session: Unknown error'
      );
    });
  });

  describe('getSessionById', () => {
    it('should return session when found', async () => {
      mockSession.findUnique.mockResolvedValue(sampleSession);

      const result = await getSessionById('session-1');

      expect(result).toEqual(sampleSession);
      expect(mockSession.findUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('should return null when not found', async () => {
      mockSession.findUnique.mockResolvedValue(null);

      const result = await getSessionById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      mockSession.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getSessionById('x')).rejects.toThrow('Failed to get session by ID: DB error');
    });
  });

  describe('updateSession', () => {
    it('should update session with provided data', async () => {
      const updated = { ...sampleSession, title: 'Updated' };
      mockSession.update.mockResolvedValue(updated);

      const result = await updateSession('session-1', { title: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { title: 'Updated' },
      });
    });

    it('should throw on error', async () => {
      mockSession.update.mockRejectedValue(new Error('Not found'));

      await expect(updateSession('x', { title: 'Y' })).rejects.toThrow(
        'Failed to update session: Not found'
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session and return it', async () => {
      mockSession.delete.mockResolvedValue(sampleSession);

      const result = await deleteSession('session-1');

      expect(result).toEqual(sampleSession);
      expect(mockSession.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('should throw on error', async () => {
      mockSession.delete.mockRejectedValue(new Error('Not found'));

      await expect(deleteSession('x')).rejects.toThrow('Failed to delete session: Not found');
    });
  });

  describe('listSessions', () => {
    it('should list sessions with default pagination', async () => {
      mockSession.findMany.mockResolvedValue([sampleSession]);

      const result = await listSessions({ userId: 'user-1' });

      expect(result).toEqual([sampleSession]);
      expect(mockSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply status filter', async () => {
      mockSession.findMany.mockResolvedValue([]);

      await listSessions({ userId: 'user-1', status: 'COMPLETED' });

      expect(mockSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should apply search filter with OR conditions', async () => {
      mockSession.findMany.mockResolvedValue([]);

      await listSessions({ userId: 'user-1', search: 'meeting' });

      const callArgs = mockSession.findMany.mock.calls[0][0];
      expect(callArgs.where.userId).toBe('user-1');
      expect(callArgs.where.OR).toEqual([
        { title: { contains: 'meeting' } },
        { description: { contains: 'meeting' } },
        { originalText: { contains: 'meeting' } },
        { refinedText: { contains: 'meeting' } },
        { tags: { contains: 'meeting' } },
      ]);
    });

    it('should apply custom pagination', async () => {
      mockSession.findMany.mockResolvedValue([]);

      await listSessions({ userId: 'user-1', page: 3, limit: 10 });

      expect(mockSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });

    it('should apply custom sort', async () => {
      mockSession.findMany.mockResolvedValue([]);

      await listSessions({ userId: 'user-1', sortBy: 'title', sortOrder: 'asc' });

      expect(mockSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { title: 'asc' },
        skip: 0,
        take: 20,
      });
    });

    it('should throw on error', async () => {
      mockSession.findMany.mockRejectedValue(new Error('DB error'));

      await expect(listSessions({ userId: 'user-1' })).rejects.toThrow(
        'Failed to list sessions: DB error'
      );
    });
  });

  describe('getSessionCount', () => {
    it('should return count for user', async () => {
      mockSession.count.mockResolvedValue(5);

      const result = await getSessionCount('user-1');

      expect(result).toBe(5);
      expect(mockSession.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('should throw on error', async () => {
      mockSession.count.mockRejectedValue(new Error('DB error'));

      await expect(getSessionCount('user-1')).rejects.toThrow(
        'Failed to get session count: DB error'
      );
    });
  });
});
