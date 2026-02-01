import { getDatabase } from '../client';
import type { ActivityLog, Prisma } from '@prisma/client';

export interface LogActivityData {
  userId?: string;
  action: string;
  details?: string;
  ipAddress?: string;
}

export interface ActivityLogFilter {
  userId?: string;
  action?: string;
  page?: number;
  limit?: number;
}

/**
 * Log an activity
 */
export async function logActivity(data: LogActivityData): Promise<ActivityLog> {
  try {
    const db = getDatabase();
    return await db.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        details: data.details,
        ipAddress: data.ipAddress,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to log activity: ${error.message}`);
    }
    throw new Error('Failed to log activity: Unknown error');
  }
}

/**
 * Get activity logs with optional filters and pagination
 */
export async function getActivityLogs(
  filter?: ActivityLogFilter
): Promise<ActivityLog[]> {
  try {
    const db = getDatabase();
    const where: Prisma.ActivityLogWhereInput = {};

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.action) {
      where.action = filter.action;
    }

    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;

    return await db.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get activity logs: ${error.message}`);
    }
    throw new Error('Failed to get activity logs: Unknown error');
  }
}
