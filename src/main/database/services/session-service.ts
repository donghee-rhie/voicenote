import { getDatabase } from '../client';
import type { Session, Prisma } from '@prisma/client';

export interface CreateSessionData {
  userId: string;
  title?: string;
  description?: string;
  originalText?: string;
  refinedText?: string;
  summary?: string;
  audioPath?: string;
  duration?: number;
  language?: string;
  provider?: string;
  model?: string;
  formatType?: string;
}

export interface UpdateSessionData {
  title?: string;
  description?: string;
  originalText?: string;
  refinedText?: string;
  summary?: string;
  audioPath?: string;
  duration?: number;
  status?: string;
  tags?: string;
  formatType?: string;
}

export interface SessionFilter {
  userId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Create a new session
 */
export async function createSession(data: CreateSessionData): Promise<Session> {
  try {
    const db = getDatabase();
    return await db.session.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        originalText: data.originalText,
        refinedText: data.refinedText,
        summary: data.summary,
        audioPath: data.audioPath,
        duration: data.duration,
        language: data.language ?? 'ko-KR',
        provider: data.provider,
        model: data.model,
        formatType: data.formatType ?? 'DEFAULT',
        status: 'DRAFT',
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
    throw new Error('Failed to create session: Unknown error');
  }
}

/**
 * Get a session by ID
 */
export async function getSessionById(id: string): Promise<Session | null> {
  try {
    const db = getDatabase();
    return await db.session.findUnique({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get session by ID: ${error.message}`);
    }
    throw new Error('Failed to get session by ID: Unknown error');
  }
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  data: UpdateSessionData
): Promise<Session> {
  try {
    const db = getDatabase();
    return await db.session.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
    throw new Error('Failed to update session: Unknown error');
  }
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<Session> {
  try {
    const db = getDatabase();
    return await db.session.delete({
      where: { id },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
    throw new Error('Failed to delete session: Unknown error');
  }
}

/**
 * List sessions with filters and pagination
 */
export async function listSessions(filter: SessionFilter): Promise<Session[]> {
  try {
    const db = getDatabase();
    const where: Prisma.SessionWhereInput = {
      userId: filter.userId,
    };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search } },
        { description: { contains: filter.search } },
        { originalText: { contains: filter.search } },
        { refinedText: { contains: filter.search } },
        { tags: { contains: filter.search } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const sortBy = filter.sortBy ?? 'createdAt';
    const sortOrder = filter.sortOrder ?? 'desc';

    return await db.session.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
    throw new Error('Failed to list sessions: Unknown error');
  }
}

/**
 * Get total session count for a user
 */
export async function getSessionCount(userId: string): Promise<number> {
  try {
    const db = getDatabase();
    return await db.session.count({
      where: { userId },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get session count: ${error.message}`);
    }
    throw new Error('Failed to get session count: Unknown error');
  }
}
