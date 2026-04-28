/**
 * Shared Roles across the system
 */
const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

/**
 * Access Levels for shared files
 */
const ACCESS_LEVELS = {
  VIEW: 'view',
  DOWNLOAD: 'download'
};

/**
 * Audit actions for tracking events
 */
const AUDIT_ACTIONS = {
  USER_REGISTRATION: 'USER_REGISTRATION',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DOWNLOADED: 'FILE_DOWNLOADED',
  FILE_DELETED: 'FILE_DELETED',
  FILE_SHARED: 'FILE_SHARED',
  SHARE_REVOKED: 'SHARE_REVOKED',
  SHARED_FILE_ACCESSED: 'SHARED_FILE_ACCESSED'
};

/**
 * Queue Job Actions
 */
const JOB_ACTIONS = {
  ANALYZE: 'analyze',
  TRANSCODE: 'transcode'
};

module.exports = {
  ROLES,
  ACCESS_LEVELS,
  AUDIT_ACTIONS,
  JOB_ACTIONS
};
