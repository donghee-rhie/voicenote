// Database client
export { getDatabase, disconnectDatabase, initializeDatabase } from './client';

// User service
export {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  listUsers,
  updateLastLogin,
  getOrCreateLocalUser,
} from './services/user-service';
export type {
  CreateUserData,
  UpdateUserData,
  UserFilter,
} from './services/user-service';

// Session service
export {
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  listSessions,
  getSessionCount,
} from './services/session-service';
export type {
  CreateSessionData,
  UpdateSessionData,
  SessionFilter,
} from './services/session-service';

// Settings service
export {
  getUserSettings,
  updateUserSettings,
  getSystemSetting,
  setSystemSetting,
  getAllSystemSettings,
} from './services/settings-service';
export type {
  UpdateUserSettingsData,
  CreateSystemSettingData,
} from './services/settings-service';

// Activity log service
export {
  logActivity,
  getActivityLogs,
} from './services/activity-log-service';
export type {
  LogActivityData,
  ActivityLogFilter,
} from './services/activity-log-service';
