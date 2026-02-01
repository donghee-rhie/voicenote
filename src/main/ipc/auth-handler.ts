import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByEmail,
  listUsers,
  updateUser,
  deleteUser,
  updateLastLogin,
} from '../database';
import type { CreateUserData, UpdateUserData, UserFilter } from '../database';
import { IPC_CHANNELS } from '../../common/types/ipc';

interface LoginRequest {
  email: string;
  password: string;
}

interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role?: string;
  status?: string;
  language?: string;
}

/**
 * Register authentication-related IPC handlers
 */
export function registerAuthHandlers() {
  // User login
  ipcMain.handle(IPC_CHANNELS.USER.LOGIN, async (_event, request: LoginRequest) => {
    try {
      const { email, password } = request;

      // Validate input
      if (!email || !password) {
        return {
          success: false,
          error: 'Email and password are required',
        };
      }

      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Check if user has a password hash
      if (!user.passwordHash) {
        return {
          success: false,
          error: 'Password not set for this user',
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Check user status
      if (user.status !== 'ACTIVE') {
        return {
          success: false,
          error: `User account is ${user.status.toLowerCase()}`,
        };
      }

      // Update last login
      await updateLastLogin(user.id);

      // Return user data (without password hash)
      const { passwordHash, ...userData } = user;
      return {
        success: true,
        data: userData,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  });

  // Create user
  ipcMain.handle(IPC_CHANNELS.USER.CREATE, async (_event, request: CreateUserRequest) => {
    try {
      const { email, name, password, role, status, language } = request;

      // Validate input
      if (!email || !name || !password) {
        return {
          success: false,
          error: 'Email, name, and password are required',
        };
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user data
      const userData: CreateUserData = {
        email,
        name,
        passwordHash,
        role,
        status,
        language,
      };

      // Create user
      const user = await createUser(userData);

      // Return user data (without password hash)
      const { passwordHash: _, ...userDataResponse } = user;
      return {
        success: true,
        data: userDataResponse,
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  });

  // List users
  ipcMain.handle(IPC_CHANNELS.USER.LIST, async (_event, filter?: UserFilter) => {
    try {
      const users = await listUsers(filter);

      // Remove password hashes from response
      const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);

      return {
        success: true,
        data: usersWithoutPasswords,
      };
    } catch (error) {
      console.error('List users error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list users',
      };
    }
  });

  // Update user
  ipcMain.handle(IPC_CHANNELS.USER.UPDATE, async (_event, id: string, data: UpdateUserData & { password?: string }) => {
    try {
      if (!id) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      // If password is being updated, hash it
      const updateData: UpdateUserData = { ...data };
      if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
        delete (updateData as any).password;
      }

      // Update user
      const user = await updateUser(id, updateData);

      // Return user data (without password hash)
      const { passwordHash, ...userData } = user;
      return {
        success: true,
        data: userData,
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  });

  // Delete user
  ipcMain.handle(IPC_CHANNELS.USER.DELETE, async (_event, id: string) => {
    try {
      if (!id) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      const user = await deleteUser(id);

      // Return user data (without password hash)
      const { passwordHash, ...userData } = user;
      return {
        success: true,
        data: userData,
      };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  });
}
