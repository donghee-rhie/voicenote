import { ipcMain } from 'electron';
import { listUsers, getSessionCount, getActivityLogs } from '../database';
import type { ActivityLogFilter } from '../database';
import { IPC_CHANNELS } from '../../common/types/ipc';

/**
 * Register admin-related IPC handlers
 */
export function registerAdminHandlers() {
  // Get system stats
  ipcMain.handle(IPC_CHANNELS.ADMIN.STATS, async () => {
    try {
      // Get user count
      const users = await listUsers();
      const userCount = users.length;

      // Count users by role
      const usersByRole = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count users by status
      const usersByStatus = users.reduce((acc, user) => {
        acc[user.status] = (acc[user.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get session count (we need to count for all users, so we'll do it differently)
      // Since getSessionCount requires userId, we'll skip it for now or modify later
      // For now, let's just return 0 or implement a count across all sessions
      const sessionCount = 0; // TODO: implement total session count

      // Get recent activity count (last 24 hours)
      const recentActivities = await getActivityLogs({
        limit: 100,
      });

      return {
        success: true,
        data: {
          userCount,
          usersByRole,
          usersByStatus,
          sessionCount,
          recentActivityCount: recentActivities.length,
        },
      };
    } catch (error) {
      console.error('Get admin stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get admin stats',
      };
    }
  });

  // Get activity logs
  ipcMain.handle(IPC_CHANNELS.ADMIN.LOGS, async (_event, filter?: ActivityLogFilter) => {
    try {
      const logs = await getActivityLogs(filter);

      return {
        success: true,
        data: logs,
      };
    } catch (error) {
      console.error('Get activity logs error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get activity logs',
      };
    }
  });
}
