import { ipcMain } from 'electron';
import {
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  listSessions,
} from '../database';
import type { CreateSessionData, UpdateSessionData, SessionFilter } from '../database';
import { IPC_CHANNELS } from '../../common/types/ipc';
import type { SessionFilterIPC } from '../../common/types/ipc';

/**
 * Register session-related IPC handlers
 */
export function registerSessionHandlers() {
  // Create session
  ipcMain.handle(IPC_CHANNELS.SESSION.CREATE, async (_event, data: CreateSessionData) => {
    try {
      console.log('[Session] Creating session, data:', {
        userId: data.userId,
        originalText: data.originalText?.substring(0, 50),
        refinedText: data.refinedText?.substring(0, 50),
        summary: data.summary?.substring(0, 50),
      });
      
      if (!data.userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      const session = await createSession(data);
      
      console.log('[Session] Created session:', session?.id);

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Create session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      };
    }
  });

  // Get session
  ipcMain.handle(IPC_CHANNELS.SESSION.GET, async (_event, id: string) => {
    try {
      if (!id) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const session = await getSessionById(id);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Get session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      };
    }
  });

  // Update session
  ipcMain.handle(IPC_CHANNELS.SESSION.UPDATE, async (_event, id: string, data: UpdateSessionData) => {
    try {
      if (!id) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const session = await updateSession(id, data);

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Update session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update session',
      };
    }
  });

  // Delete session
  ipcMain.handle(IPC_CHANNELS.SESSION.DELETE, async (_event, id: string) => {
    try {
      if (!id) {
        return {
          success: false,
          error: 'Session ID is required',
        };
      }

      const session = await deleteSession(id);

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Delete session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session',
      };
    }
  });

  // List sessions
  ipcMain.handle(IPC_CHANNELS.SESSION.LIST, async (_event, filter?: SessionFilterIPC) => {
    try {
      if (!filter || !filter.userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      // Convert IPC filter to database filter
      const dbFilter: SessionFilter = {
        userId: filter.userId,
      };

      if (filter.status) {
        dbFilter.status = filter.status;
      }
      if (filter.search) {
        dbFilter.search = filter.search;
      }
      if (filter.limit !== undefined) {
        dbFilter.limit = filter.limit;
      }
      if (filter.offset !== undefined) {
        // Convert offset to page number
        const page = filter.limit ? Math.floor(filter.offset / filter.limit) + 1 : 1;
        dbFilter.page = page;
      }

      const sessions = await listSessions(dbFilter);

      return {
        success: true,
        data: sessions,
      };
    } catch (error) {
      console.error('List sessions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list sessions',
      };
    }
  });

  // Search sessions (alias for list with search)
  ipcMain.handle(IPC_CHANNELS.SESSION.SEARCH, async (_event, filter?: SessionFilterIPC) => {
    try {
      if (!filter || !filter.userId) {
        return {
          success: false,
          error: 'User ID is required',
        };
      }

      // Reuse list handler logic
      const dbFilter: SessionFilter = {
        userId: filter.userId,
      };

      if (filter.status) {
        dbFilter.status = filter.status;
      }
      if (filter.search) {
        dbFilter.search = filter.search;
      }
      if (filter.limit !== undefined) {
        dbFilter.limit = filter.limit;
      }
      if (filter.offset !== undefined) {
        // Convert offset to page number
        const page = filter.limit ? Math.floor(filter.offset / filter.limit) + 1 : 1;
        dbFilter.page = page;
      }

      const sessions = await listSessions(dbFilter);

      return {
        success: true,
        data: sessions,
      };
    } catch (error) {
      console.error('Search sessions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search sessions',
      };
    }
  });
}
