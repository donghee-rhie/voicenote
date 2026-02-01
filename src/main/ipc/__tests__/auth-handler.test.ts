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
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  updateLastLogin: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByEmail,
  listUsers,
  updateUser,
  deleteUser,
  updateLastLogin,
} from '../../database';
import { registerAuthHandlers } from '../auth-handler';
import { IPC_CHANNELS } from '../../../common/types/ipc';

const mockEvent = {} as Electron.IpcMainInvokeEvent;

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '$2a$10$hashedpassword',
  role: 'USER',
  status: 'ACTIVE',
  language: 'ko',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  lastLoginAt: null,
};

describe('Auth Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear registered handlers
    Object.keys(registeredHandlers).forEach((key) => delete registeredHandlers[key]);
    registerAuthHandlers();
  });

  describe('registerAuthHandlers', () => {
    it('should register all expected IPC channels', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.USER.LOGIN, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.USER.CREATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.USER.LIST, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.USER.UPDATE, expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith(IPC_CHANNELS.USER.DELETE, expect.any(Function));
    });
  });

  describe('user:login', () => {
    it('should return user data on valid credentials', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(updateLastLogin).mockResolvedValue(undefined as any);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.email).toBe('test@example.com');
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(updateLastLogin).toHaveBeenCalledWith('user-1');
    });

    it('should fail when email is not found', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail when password is invalid', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should fail when user is inactive', async () => {
      const inactiveUser = { ...mockUser, status: 'INACTIVE' };
      vi.mocked(getUserByEmail).mockResolvedValue(inactiveUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User account is inactive');
    });

    it('should fail when email or password is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: '',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email and password are required');
    });

    it('should fail when user has no password hash', async () => {
      const noPasswordUser = { ...mockUser, passwordHash: null };
      vi.mocked(getUserByEmail).mockResolvedValue(noPasswordUser as any);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password not set for this user');
    });

    it('should handle unexpected errors gracefully', async () => {
      vi.mocked(getUserByEmail).mockRejectedValue(new Error('DB connection failed'));

      const result = await registeredHandlers[IPC_CHANNELS.USER.LOGIN](mockEvent, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB connection failed');
    });
  });

  describe('user:create', () => {
    it('should create user with valid data', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhash' as never);
      vi.mocked(createUser).mockResolvedValue({ ...mockUser, passwordHash: '$2a$10$newhash' });

      const result = await registeredHandlers[IPC_CHANNELS.USER.CREATE](mockEvent, {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          passwordHash: '$2a$10$newhash',
        })
      );
    });

    it('should fail when email already exists', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(mockUser);

      const result = await registeredHandlers[IPC_CHANNELS.USER.CREATE](mockEvent, {
        email: 'test@example.com',
        name: 'Duplicate User',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });

    it('should fail when required fields are missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.USER.CREATE](mockEvent, {
        email: '',
        name: '',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email, name, and password are required');
    });

    it('should handle database error on create', async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhash' as never);
      vi.mocked(createUser).mockRejectedValue(new Error('Unique constraint failed'));

      const result = await registeredHandlers[IPC_CHANNELS.USER.CREATE](mockEvent, {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unique constraint failed');
    });
  });

  describe('user:list', () => {
    it('should return users without password hashes', async () => {
      vi.mocked(listUsers).mockResolvedValue([mockUser]);

      const result = await registeredHandlers[IPC_CHANNELS.USER.LIST](mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
      expect(result.data[0].email).toBe('test@example.com');
    });

    it('should pass filter to listUsers', async () => {
      vi.mocked(listUsers).mockResolvedValue([]);

      const filter = { role: 'ADMIN' };
      await registeredHandlers[IPC_CHANNELS.USER.LIST](mockEvent, filter);

      expect(listUsers).toHaveBeenCalledWith(filter);
    });

    it('should handle database error', async () => {
      vi.mocked(listUsers).mockRejectedValue(new Error('DB error'));

      const result = await registeredHandlers[IPC_CHANNELS.USER.LIST](mockEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });
  });

  describe('user:update', () => {
    it('should update user without password change', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      vi.mocked(updateUser).mockResolvedValue(updatedUser);

      const result = await registeredHandlers[IPC_CHANNELS.USER.UPDATE](mockEvent, 'user-1', {
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(updateUser).toHaveBeenCalledWith('user-1', { name: 'Updated Name' });
    });

    it('should hash password when password is provided', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$newhash' as never);
      vi.mocked(updateUser).mockResolvedValue(mockUser);

      await registeredHandlers[IPC_CHANNELS.USER.UPDATE](mockEvent, 'user-1', {
        password: 'newpassword',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ passwordHash: '$2a$10$newhash' })
      );
    });

    it('should fail when user ID is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.USER.UPDATE](mockEvent, '', {
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error on update', async () => {
      vi.mocked(updateUser).mockRejectedValue(new Error('User not found'));

      const result = await registeredHandlers[IPC_CHANNELS.USER.UPDATE](mockEvent, 'user-999', {
        name: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('user:delete', () => {
    it('should delete user and return data without password', async () => {
      vi.mocked(deleteUser).mockResolvedValue(mockUser);

      const result = await registeredHandlers[IPC_CHANNELS.USER.DELETE](mockEvent, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(deleteUser).toHaveBeenCalledWith('user-1');
    });

    it('should fail when user ID is missing', async () => {
      const result = await registeredHandlers[IPC_CHANNELS.USER.DELETE](mockEvent, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should handle database error on delete', async () => {
      vi.mocked(deleteUser).mockRejectedValue(new Error('Cannot delete user'));

      const result = await registeredHandlers[IPC_CHANNELS.USER.DELETE](mockEvent, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete user');
    });
  });
});
