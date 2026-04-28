const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const config = require('../config/env');
const { User } = require('../models/User');

/**
 * Verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      logger.warn({
        ip: req.ip,
        path: req.path
      }, 'Missing authorization token');

      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization token'
      });
    }

    // Verify token against blacklist first
    try {
      const redisClient = require('../config/redis');
      const isBlacklisted = await redisClient.get(`bl_${token}`);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          error: 'Token has been revoked'
        });
      }
    } catch (redisErr) {
      logger.warn('Redis check failed, continuing auth', redisErr.message);
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Load user from database
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      logger.warn({
        userId: decoded.userId,
        ip: req.ip
      }, 'User not found or inactive');

      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Attach user and token metadata to request
    req.user = user;
    req.tokenMetadata = decoded;

    logger.debug({
      userId: user.id,
      username: user.username
    }, 'User authenticated');

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn({
        ip: req.ip,
        expiredAt: error.expiredAt
      }, 'Token expired');

      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        expiredAt: error.expiredAt
      });
    }

    if (error.name === 'JsonWebTokenError') {
      logger.warn({
        ip: req.ip,
        error: error.message
      }, 'Invalid token');

      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    logger.error({
      error: error.message,
      ip: req.ip
    }, 'Authentication failed');

    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Check if user has required role - RBAC implementation
 * @param {...string} allowedRoles - Roles allowed to access endpoint
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn({
        ip: req.ip,
        path: req.path
      }, 'Unauthorized - no user context');

      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path
      }, 'Forbidden - insufficient permissions');

      return res.status(403).json({
        success: false,
        error: 'Forbidden - insufficient permissions'
      });
    }

    logger.debug({
      userId: req.user.id,
      userRole: req.user.role
    }, 'Authorization check passed');

    next();
  };
}

/**
 * Require owner access - user can only access their own resources
 */
async function requireOwner(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check if accessing own resource
    const resourceOwnerId = req.params.userId || req.body?.userId;
    
    if (resourceOwnerId && resourceOwnerId !== req.user.id) {
      // Admin can access any resource
      if (req.user.role !== 'admin') {
        logger.warn({
          userId: req.user.id,
          attemptedResourceId: resourceOwnerId,
          path: req.path
        }, 'Owner check failed - access denied');

        return res.status(403).json({
          success: false,
          error: 'You can only access your own resources'
        });
      }
    }

    next();
  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user?.id
    }, 'Owner check failed');

    res.status(500).json({
      success: false,
      error: 'Authorization check failed'
    });
  }
}

/**
 * Optional authentication - attaches user if token exists, doesn't fail if missing
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token provided - this is okay for optional auth
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId);

      if (user && user.status === 'active') {
        req.user = user;
        req.tokenMetadata = decoded;
      }
    } catch (error) {
      // Invalid token but optional - just continue
      logger.debug({
        error: error.message
      }, 'Optional token validation failed, continuing without user');
    }

    next();
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Optional auth check failed');
    
    next(); // Don't fail on optional auth
  }
}

/**
 * Extract JWT token from request
 * Supports: Authorization header (Bearer), cookies, query param
 */
function extractToken(req) {
  // From Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // From cookies (if using cookie-based auth)
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  // From query parameters (less secure but sometimes needed)
  if (req.query?.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Generate JWT token
 */
function generateToken(userId, additionalClaims = {}) {
  return jwt.sign(
    {
      userId,
      ...additionalClaims
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
      algorithm: 'HS256'
    }
  );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    {
      userId,
      type: 'refresh'
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
      algorithm: 'HS256'
    }
  );
}

module.exports = {
  authenticate,
  authorize,
  requireOwner,
  optionalAuth,
  extractToken,
  generateToken,
  generateRefreshToken
};
