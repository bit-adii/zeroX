const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const config = require('./env');

let db = null;

/**
 * Initialize database connection and create tables
 */
async function initializeDatabase() {
  try {
    // Ensure directory exists
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database connection
    db = await open({
      filename: config.database.path,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Create tables
    await createTables();
    
    logger.info({ path: config.database.path }, 'Database initialized successfully');
    return db;
  } catch (error) {
    logger.error({ error, path: config.database.path }, 'Database initialization failed');
    throw error;
  }
}

/**
 * Create database schema
 */
async function createTables() {
  const tables = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      public_key TEXT NOT NULL,
      private_key_encrypted TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Files table
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mimetype TEXT,
      encryption_iv TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // Access logs table
    `CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // File sharing table
    `CREATE TABLE IF NOT EXISTS file_shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      expires_at INTEGER,
      access_level TEXT DEFAULT 'view',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )`,

    // Audit logs table
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      status TEXT,
      created_at INTEGER NOT NULL
    )`
  ];

  for (const sql of tables) {
    await db.exec(sql);
  }

  // Create indexes for performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_file_id ON access_logs(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_shares_owner_id ON file_shares(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
  ];

  for (const sql of indexes) {
    await db.exec(sql);
  }
}

/**
 * Get database connection
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first');
  }
  return db;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};
