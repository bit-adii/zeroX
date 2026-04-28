const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const config = require('../config/env');

/**
 * General API rate limiter - protects all endpoints
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimiter.windowMs,
  max: config.rateLimiter.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Optionally skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      path: req.path,
      method: req.method
    }, 'Rate limit exceeded');
    
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime
    });
  },
  onLimitReached: (req, res, options) => {
    logger.error({
      ip: req.ip,
      limit: config.rateLimiter.maxRequests
    }, 'Rate limit threshold reached');
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  keyGenerator: (req) => {
    // Rate limit by both IP and username for POST requests
    return `${req.ip}:${req.body?.username || 'unknown'}`;
  },
  handler: (req, res) => {
    logger.warn({
      ip: req.ip,
      username: req.body?.username,
      path: req.path
    }, 'Auth rate limit exceeded - possible brute force');
    
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Upload rate limiter - limits file uploads per user
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Upload limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({
      userId: req.user?.id,
      ip: req.ip
    }, 'Upload rate limit exceeded');
    
    res.status(429).json({
      success: false,
      error: 'Upload limit exceeded',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Strict rate limiter for password reset
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.email || req.ip;
  },
  handler: (req, res) => {
    logger.warn({
      email: req.body?.email,
      ip: req.ip
    }, 'Password reset rate limit exceeded');
    
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Share link rate limiter - prevents DoS on share endpoint
 */
const shareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 shares per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.warn({
      userId: req.user?.id,
      ip: req.ip
    }, 'Share rate limit exceeded');
    
    res.status(429).json({
      success: false,
      error: 'Share limit exceeded',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  passwordResetLimiter,
  shareLimiter
};
