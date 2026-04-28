require('dotenv').config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'DATABASE_PATH',
  'REDIS_URL'
];

// Check required environment variables
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Security
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRE || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  },

  encryption: {
    key: Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), // 32 bytes for AES-256
    algorithm: 'aes-256-gcm'
  },

  // Database
  database: {
    path: process.env.DATABASE_PATH || './data/zerotrust.db',
    mode: parseInt(process.env.DB_MODE || '33185', 8) // SQLite open flags
  },

  // Redis (for queues and caching)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Rate limiting
  rateLimiter: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },

  // File upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1048576', 10) // 1MB
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Feature flags
  features: {
    enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    enableCors: process.env.ENABLE_CORS !== 'false'
  },

  // CORS
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(','),
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  }
};

// Validate encryption key length for AES-256
if (config.encryption.key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) for AES-256. Provide as hex string.');
}

module.exports = config;
