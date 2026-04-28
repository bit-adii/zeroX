const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { getDatabase } = require('../config/db');

/**
 * User model - handles user data and operations
 */
class User {
  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create(userData) {
    try {
      const db = getDatabase();
      const {
        username,
        email,
        passwordHash,
        publicKey,
        privateKeyEncrypted = null,
        role = 'user',
        metadata = {}
      } = userData;

      // Validate required fields
      if (!username || !email || !passwordHash || !publicKey) {
        throw new Error('Missing required fields: username, email, passwordHash, publicKey');
      }

      const userId = uuidv4();
      const now = Date.now();

      await db.run(
        `INSERT INTO users 
         (id, username, email, password_hash, public_key, private_key_encrypted, role, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          username,
          email,
          passwordHash,
          publicKey,
          privateKeyEncrypted,
          role,
          'active',
          JSON.stringify(metadata),
          now,
          now
        ]
      );

      logger.info({ userId, username, email }, 'User created');
      return User.findById(userId);
    } catch (error) {
      logger.error({ error: error.message, ...userData }, 'User creation failed');
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User object
   */
  static async findById(userId) {
    try {
      const db = getDatabase();
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
      
      if (!user) {
        return null;
      }

      return User._parseUser(user);
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to find user by ID');
      throw error;
    }
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object>} User object
   */
  static async findByUsername(username) {
    try {
      const db = getDatabase();
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      return user ? User._parseUser(user) : null;
    } catch (error) {
      logger.error({ error: error.message, username }, 'Failed to find user by username');
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - Email
   * @returns {Promise<Object>} User object
   */
  static async findByEmail(email) {
    try {
      const db = getDatabase();
      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      return user ? User._parseUser(user) : null;
    } catch (error) {
      logger.error({ error: error.message, email }, 'Failed to find user by email');
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  static async update(userId, updates) {
    try {
      const db = getDatabase();
      const allowedFields = ['password_hash', 'public_key', 'private_key_encrypted', 'role', 'status', 'metadata'];
      
      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(dbKey)) {
          updateFields.push(`${dbKey} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = ?');
      updateValues.push(Date.now());
      updateValues.push(userId);

      await db.run(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      logger.debug({ userId }, 'User updated');
      return User.findById(userId);
    } catch (error) {
      logger.error({ error: error.message, userId }, 'User update failed');
      throw error;
    }
  }

  /**
   * Helper to parse user object
   */
  static _parseUser(user) {
    let metadata = {};
    if (user.metadata) {
      try { metadata = JSON.parse(user.metadata); } catch { metadata = {}; }
    }
    return { ...user, metadata };
  }
}

/**
 * File model - handles file data and operations
 */
class File {
  /**
   * Create file record
   * @param {Object} fileData - File data
   * @returns {Promise<Object>} Created file
   */
  static async create(fileData) {
    try {
      const db = getDatabase();
      const {
        userId,
        filename,
        originalFilename,
        size,
        mimetype,
        encryptionIv,
        metadata = {}
      } = fileData;

      if (!userId || !filename || !size || !encryptionIv) {
        throw new Error('Missing required fields');
      }

      const fileId = uuidv4();
      const now = Date.now();

      await db.run(
        `INSERT INTO files 
         (id, user_id, filename, original_filename, size, mimetype, encryption_iv, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileId,
          userId,
          filename,
          originalFilename,
          size,
          mimetype,
          encryptionIv,
          JSON.stringify(metadata),
          now,
          now
        ]
      );

      logger.info({ fileId, userId, filename }, 'File record created');
      return File.findById(fileId);
    } catch (error) {
      logger.error({ error: error.message }, 'File creation failed');
      throw error;
    }
  }

  /**
   * Find file by ID
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File object
   */
  static async findById(fileId) {
    try {
      const db = getDatabase();
      const file = await db.get('SELECT * FROM files WHERE id = ?', [fileId]);
      return file ? File._parseFile(file) : null;
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'Failed to find file');
      throw error;
    }
  }

  /**
   * Get files for user with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination options
   * @returns {Promise<Array>} User's files
   */
  static async findByUser(userId, options = {}) {
    try {
      const db = getDatabase();
      const { limit = 50, offset = 0 } = options;

      const files = await db.all(
        `SELECT * FROM files WHERE user_id = ? 
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return files ? files.map(File._parseFile) : [];
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to find user files');
      throw error;
    }
  }

  /**
   * Update file
   * @param {string} fileId - File ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated file
   */
  static async update(fileId, updates) {
    try {
      const db = getDatabase();
      const allowedFields = ['filename', 'mimetype', 'metadata', 'size'];
      
      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = ?');
      updateValues.push(Date.now());
      updateValues.push(fileId);

      await db.run(
        `UPDATE files SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      logger.debug({ fileId }, 'File updated');
      return File.findById(fileId);
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'File update failed');
      throw error;
    }
  }

  /**
   * Delete file
   * @param {string} fileId - File ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(fileId) {
    try {
      const db = getDatabase();
      await db.run('DELETE FROM files WHERE id = ?', [fileId]);
      logger.info({ fileId }, 'File deleted');
      return true;
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'File deletion failed');
      throw error;
    }
  }

  /**
   * Helper to parse file object
   */
  static _parseFile(file) {
    let metadata = {};
    if (file.metadata) {
      try { metadata = JSON.parse(file.metadata); } catch { metadata = {}; }
    }
    return { ...file, metadata };
  }
}

/**
 * AccessLog model - handles access tracking
 */
class AccessLog {
  /**
   * Create access log entry
   * @param {Object} logData - Log data
   * @returns {Promise<Object>} Created log
   */
  static async create(logData) {
    try {
      const db = getDatabase();
      const {
        fileId,
        userId,
        action,
        ipAddress,
        userAgent,
        status = 'success',
        metadata = {}
      } = logData;

      if (!fileId || !userId || !action) {
        throw new Error('Missing required fields');
      }

      const logId = uuidv4();

      await db.run(
        `INSERT INTO access_logs 
         (id, file_id, user_id, action, ip_address, user_agent, status, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          fileId,
          userId,
          action,
          ipAddress,
          userAgent,
          status,
          JSON.stringify(metadata),
          Date.now()
        ]
      );

      return { id: logId, ...logData, createdAt: Date.now() };
    } catch (error) {
      logger.error({ error: error.message }, 'Access log creation failed');
      throw error;
    }
  }

  /**
   * Get logs for file
   * @param {string} fileId - File ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Access logs
   */
  static async findByFile(fileId, options = {}) {
    try {
      const db = getDatabase();
      const { limit = 100, offset = 0 } = options;

      const logs = await db.all(
        `SELECT * FROM access_logs WHERE file_id = ? 
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [fileId, limit, offset]
      );

      return logs ? logs.map(AccessLog._parseLog) : [];
    } catch (error) {
      logger.error({ error: error.message, fileId }, 'Failed to find file logs');
      throw error;
    }
  }

  /**
   * Helper to parse log object
   */
  static _parseLog(log) {
    let metadata = {};
    if (log.metadata) {
      try { metadata = JSON.parse(log.metadata); } catch { metadata = {}; }
    }
    return { ...log, metadata };
  }
}

module.exports = {
  User,
  File,
  AccessLog
};
