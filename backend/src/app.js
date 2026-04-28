require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { v4: correlationId } = require('uuid');
const cookieParser = require('cookie-parser');

// Import configuration and utilities
const config = require('./config/env');
const { logger } = require('./utils/logger');
const { initializeDatabase } = require('./config/db');
const { initializeQueueProcessors } = require('./services/queueService');

// Import middleware
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const shareRoutes = require('./routes/shareRoutes');

// Initialize Express app
const app = express();

/**
 * ============ MIDDLEWARE SETUP ============
 */

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origins,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Body parsers
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cookieParser());

// Request correlation ID for tracing
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || correlationId();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId
    }, `${req.method} ${req.path}`);
  });

  next();
});

// Rate limiting
if (config.features.enableRateLimiting) {
  app.use(apiLimiter);
}

/**
 * ============ ROUTES ============
 */

// Health check endpoint (not rate limited)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
const apiPrefix = config.apiPrefix;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/upload`, uploadRoutes);
app.use(`${apiPrefix}/share`, shareRoutes);

/**
 * ============ ERROR HANDLING ============
 */

// 404 handler
app.use((req, res) => {
  logger.warn({
    method: req.method,
    path: req.path,
    ip: req.ip
  }, 'Route not found');

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    correlationId: req.correlationId
  }, 'Unhandled error');

  res.status(error.status || 500).json({
    success: false,
    error: config.nodeEnv === 'development' 
      ? error.message 
      : 'Internal server error',
    correlationId: req.correlationId
  });
});

/**
 * ============ SERVER INITIALIZATION ============
 */

async function initializeServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize queue processors
    await initializeQueueProcessors();
    logger.info('Queue processors initialized');

    // Start server
    const port = config.port;
    const server = app.listen(port, () => {
      logger.info({
        port,
        environment: config.nodeEnv,
        apiPrefix
      }, `Server running on http://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      
      server.close(async () => {
        const { closeAllQueues } = require('./config/queue');
        const { closeDatabase } = require('./config/db');
        
        try {
          await closeAllQueues();
          await closeDatabase();
          logger.info('Server shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error({ error: error.message }, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown - could not close gracefully');
        process.exit(1);
      }, 10000);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      process.emit('SIGTERM');
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack
    }, 'Failed to initialize server');
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module) {
  initializeServer();
}

module.exports = app;
