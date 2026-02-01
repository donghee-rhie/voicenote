import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUser = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../client', () => ({
  getDatabase: () => ({
    user: mockUser,
  }),
}));

import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  listUsers,
  updateLastLogin,
} from '../services/user-service';

const sampleUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: null,
  role: 'USER',
  status: 'PENDING',
  language: 'ko',
  lastLoginAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('user-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user with default values', async () => {
      mockUser.create.mockResolvedValue(sampleUser);

      const result = await createUser({ email: 'test@example.com', name: 'Test User' });

      expect(result).toEqual(sampleUser);
      expect(mockUser.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: undefined,
          role: 'USER',
          status: 'PENDING',
          language: 'ko',
        },
      });
    });

    it('should create a user with custom values', async () => {
      const customUser = { ...sampleUser, role: 'ADMIN', status: 'ACTIVE', language: 'en' };
      mockUser.create.mockResolvedValue(customUser);

      const result = await createUser({
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        status: 'ACTIVE',
        language: 'en',
        passwordHash: 'hashed',
      });

      expect(result).toEqual(customUser);
      expect(mockUser.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed',
          role: 'ADMIN',
          status: 'ACTIVE',
          language: 'en',
        },
      });
    });

    it('should throw a descriptive error when creation fails', async () => {
      mockUser.create.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(createUser({ email: 'dup@example.com', name: 'Dup' })).rejects.toThrow(
        'Failed to create user: Unique constraint violation'
      );
    });

    it('should throw unknown error when non-Error is thrown', async () => {
      mockUser.create.mockRejectedValue('string error');

      await expect(createUser({ email: 'x@x.com', name: 'X' })).rejects.toThrow(
        'Failed to create user: Unknown error'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockUser.findUnique.mockResolvedValue(sampleUser);

      const result = await getUserById('user-1');

      expect(result).toEqual(sampleUser);
      expect(mockUser.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should return null when user not found', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const result = await getUserById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      mockUser.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getUserById('user-1')).rejects.toThrow('Failed to get user by ID: DB error');
    });

    it('should throw unknown error for non-Error objects', async () => {
      mockUser.findUnique.mockRejectedValue(42);

      await expect(getUserById('user-1')).rejects.toThrow('Failed to get user by ID: Unknown error');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      mockUser.findUnique.mockResolvedValue(sampleUser);

      const result = await getUserByEmail('test@example.com');

      expect(result).toEqual(sampleUser);
      expect(mockUser.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('should return null when not found', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const result = await getUserByEmail('nobody@example.com');

      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      mockUser.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getUserByEmail('test@example.com')).rejects.toThrow(
        'Failed to get user by email: DB error'
      );
    });
  });

  describe('listUsers', () => {
    it('should list all users without filters', async () => {
      mockUser.findMany.mockResolvedValue([sampleUser]);

      const result = await listUsers();

      expect(result).toEqual([sampleUser]);
      expect(mockUser.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply role filter', async () => {
      mockUser.findMany.mockResolvedValue([]);

      await listUsers({ role: 'ADMIN' });

      expect(mockUser.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply status filter', async () => {
      mockUser.findMany.mockResolvedValue([]);

      await listUsers({ status: 'ACTIVE' });

      expect(mockUser.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply both role and status filters', async () => {
      mockUser.findMany.mockResolvedValue([]);

      await listUsers({ role: 'ADMIN', status: 'ACTIVE' });

      expect(mockUser.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw on error', async () => {
      mockUser.findMany.mockRejectedValue(new Error('DB error'));

      await expect(listUsers()).rejects.toThrow('Failed to list users: DB error');
    });
  });

  describe('updateUser', () => {
    it('should update user with provided data', async () => {
      const updated = { ...sampleUser, name: 'Updated Name' };
      mockUser.update.mockResolvedValue(updated);

      const result = await updateUser('user-1', { name: 'Updated Name' });

      expect(result).toEqual(updated);
      expect(mockUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
      });
    });

    it('should throw on error', async () => {
      mockUser.update.mockRejectedValue(new Error('Not found'));

      await expect(updateUser('bad-id', { name: 'X' })).rejects.toThrow(
        'Failed to update user: Not found'
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user and return deleted record', async () => {
      mockUser.delete.mockResolvedValue(sampleUser);

      const result = await deleteUser('user-1');

      expect(result).toEqual(sampleUser);
      expect(mockUser.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should throw on error', async () => {
      mockUser.delete.mockRejectedValue(new Error('Not found'));

      await expect(deleteUser('bad-id')).rejects.toThrow('Failed to delete user: Not found');
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt with current date', async () => {
      const updated = { ...sampleUser, lastLoginAt: new Date() };
      mockUser.update.mockResolvedValue(updated);

      const before = new Date();
      const result = await updateLastLogin('user-1');
      const after = new Date();

      expect(result).toEqual(updated);
      const callArgs = mockUser.update.mock.calls[0][0];
      expect(callArgs.where).toEqual({ id: 'user-1' });
      expect(callArgs.data.lastLoginAt).toBeInstanceOf(Date);
      expect(callArgs.data.lastLoginAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(callArgs.data.lastLoginAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw on error', async () => {
      mockUser.update.mockRejectedValue(new Error('Not found'));

      await expect(updateLastLogin('bad-id')).rejects.toThrow(
        'Failed to update last login: Not found'
      );
    });
  });
});
