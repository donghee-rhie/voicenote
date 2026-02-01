import { getDatabase } from '../client';
import type { User, Prisma } from '@prisma/client';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash?: string;
  role?: string;
  status?: string;
  language?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  passwordHash?: string;
  role?: string;
  status?: string;
  language?: string;
}

export interface UserFilter {
  role?: string;
  status?: string;
}

// 기본 로컬 사용자 ID
const LOCAL_USER_ID = 'local-user';

/**
 * Get or create default local user (for standalone mode without login)
 */
export async function getOrCreateLocalUser(): Promise<User> {
  try {
    const db = getDatabase();
    
    // 먼저 기존 로컬 사용자 찾기
    let user = await db.user.findUnique({
      where: { id: LOCAL_USER_ID },
    });
    
    // 없으면 생성
    if (!user) {
      user = await db.user.create({
        data: {
          id: LOCAL_USER_ID,
          email: 'local@voicenote.app',
          name: '사용자',
          role: 'ADMIN',
          status: 'ACTIVE',
          language: 'ko',
        },
      });
      console.log('[Database] Created default local user');
    }
    
    return user;
  } catch (error) {
    console.error('Failed to get/create local user:', error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserData): Promise<User> {
  try {
    const db = getDatabase();
    return await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role ?? 'USER',
        status: data.status ?? 'PENDING',
        language: data.language ?? 'ko',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
    throw new Error('Failed to create user: Unknown error');
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const db = getDatabase();
    return await db.user.findUnique({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
    throw new Error('Failed to get user by ID: Unknown error');
  }
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const db = getDatabase();
    return await db.user.findUnique({
      where: { email },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get user by email: ${error.message}`);
    }
    throw new Error('Failed to get user by email: Unknown error');
  }
}

/**
 * Update a user
 */
export async function updateUser(
  id: string,
  data: UpdateUserData
): Promise<User> {
  try {
    const db = getDatabase();
    return await db.user.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    throw new Error('Failed to update user: Unknown error');
  }
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<User> {
  try {
    const db = getDatabase();
    return await db.user.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
    throw new Error('Failed to delete user: Unknown error');
  }
}

/**
 * List users with optional filters
 */
export async function listUsers(filter?: UserFilter): Promise<User[]> {
  try {
    const db = getDatabase();
    const where: Prisma.UserWhereInput = {};

    if (filter?.role) {
      where.role = filter.role;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    return await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    throw new Error('Failed to list users: Unknown error');
  }
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(id: string): Promise<User> {
  try {
    const db = getDatabase();
    return await db.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update last login: ${error.message}`);
    }
    throw new Error('Failed to update last login: Unknown error');
  }
}
