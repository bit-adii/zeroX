const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { getDatabase } = require('../config/db');

/**
 * Log user action to audit log for compliance and security monitoring
 * @param {string} userId - User ID performing action
 * @param {string} action - Action type (e.g., 'FILE_UPLOAD', 'FILE_ACCESS', 'USER_LOGIN')
 * @param {Object} options - Additional logging options
 */
async function logAction(userId, action, options = {}) {
  try {
    const db = getDatabase();
    const {
      resourceType,
      resourceId,
      details,
      ipAddress,
      status = 'success',
      metadata = {}
    } = options;

    const auditLog = {
      id: uuidv4(),
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: JSON.stringify(details || {}),
      ip_address: ipAddress,
      status,
      metadata: JSON.stringify(metadata),
      created_at: Date.now()
    };

    await db.run(
      `INSERT INTO audit_logs 
       (id, user_id, action, resource_type, resource_id, details, ip_address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditLog.id,
        auditLog.user_id,
        auditLog.action,
        auditLog.resource_type,
        auditLog.resource_id,
        auditLog.details,
        auditLog.ip_address,
        auditLog.status,
        auditLog.created_at
      ]
    );

    logger.info({
      auditId: auditLog.id,
      userId,
      action,
      status,
      resourceType,
      resourceId
    }, 'Action logged to audit trail');

    return auditLog.id;
  } catch (error) {
    logger.error({
      error: error.message,
      userId,
      action
    }, 'Failed to log action to audit trail');
    // Don't throw - audit logging should not break application flow
  }
}

/**
 * Log file access event
 * @param {string} fileId - File ID
 * @param {string} userId - User accessing file
 * @param {string} action - Access action (VIEW, DOWNLOAD, DELETE, SHARE)
 * @param {Object} options - Additional options
 */
async function logFileAccess(fileId, userId, action, options = {}) {
  try {
    const db = getDatabase();
    const accessLog = {
      id: uuidv4(),
      file_id: fileId,
      user_id: userId,
      action,
      ip_address: options.ipAddress,
      user_agent: options.userAgent,
      status: options.status || 'success',
      metadata: JSON.stringify(options.metadata || {}),
      created_at: Date.now()
    };

    await db.run(
      `INSERT INTO access_logs 
       (id, file_id, user_id, action, ip_address, user_agent, status, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accessLog.id,
        accessLog.file_id,
        accessLog.user_id,
        accessLog.action,
        accessLog.ip_address,
        accessLog.user_agent,
        accessLog.status,
        accessLog.metadata,
        accessLog.created_at
      ]
    );

    logger.debug({
      fileId,
      userId,
      action,
      status: options.status
    }, 'File access logged');

    return accessLog.id;
  } catch (error) {
    logger.error({
      error: error.message,
      fileId,
      userId,
      action
    }, 'Failed to log file access');
  }
}

/**
 * Get audit logs with filtering
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Audit logs matching filters
 */
async function getAuditLogs(filters = {}) {
  try {
    const db = getDatabase();
    const {
      userId,
      action,
      resourceType,
      startDate = Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days
      endDate = Date.now(),
      limit = 1000,
      offset = 0
    } = filters;

    let query = 'SELECT * FROM audit_logs WHERE created_at BETWEEN ? AND ?';
    const params = [startDate, endDate];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await db.all(query, params);
    return logs || [];
  } catch (error) {
    logger.error({
      error: error.message,
      filters
    }, 'Failed to retrieve audit logs');
    throw error;
  }
}

/**
 * Get file access logs
 * @param {string} fileId - File ID to get logs for
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Access logs for file
 */
async function getFileAccessLogs(fileId, filters = {}) {
  try {
    const db = getDatabase();
    const {
      startDate = Date.now() - (30 * 24 * 60 * 60 * 1000),
      endDate = Date.now(),
      limit = 500,
      offset = 0
    } = filters;

    const logs = await db.all(
      `SELECT * FROM access_logs 
       WHERE file_id = ? AND created_at BETWEEN ? AND ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [fileId, startDate, endDate, limit, offset]
    );

    return logs || [];
  } catch (error) {
    logger.error({
      error: error.message,
      fileId
    }, 'Failed to retrieve file access logs');
    throw error;
  }
}

/**
 * Get user activity summary
 * @param {string} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Activity summary
 */
async function getUserActivitySummary(userId, days = 30) {
  try {
    const db = getDatabase();
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    const summary = await db.get(
      `SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT action) as unique_actions,
        MIN(created_at) as first_activity,
        MAX(created_at) as last_activity
       FROM audit_logs
       WHERE user_id = ? AND created_at > ?`,
      [userId, startDate]
    );

    const actionCounts = await db.all(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE user_id = ? AND created_at > ?
       GROUP BY action
       ORDER BY count DESC`,
      [userId, startDate]
    );

    return {
      ...summary,
      actionBreakdown: actionCounts || []
    };
  } catch (error) {
    logger.error({
      error: error.message,
      userId
    }, 'Failed to get user activity summary');
    throw error;
  }
}

module.exports = {
  logAction,
  logFileAccess,
  getAuditLogs,
  getFileAccessLogs,
  getUserActivitySummary
};
