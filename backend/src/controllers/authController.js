const { logger } = require('../utils/logger');
const { User } = require('../models/User');
const { auditService } = require('../services');
const { encryptionService } = require('../services');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Register new user
 * POST /api/v1/auth/register
 */
async function register(req, res) {
  try {
    const { username, email, password, publicKey } = req.body;

    // Check if user already exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      logger.warn({ username }, 'Registration failed - username exists');
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      logger.warn({ email }, 'Registration failed - email exists');
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }

    // Hash password
    const passwordHash = await encryptionService.hashPassword(password);

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
      publicKey,
      metadata: {
        registeredAt: new Date().toISOString(),
        registrationIp: req.ip
      }
    });

    // Log registration
    await auditService.logAction(user.id, 'USER_REGISTRATION', {
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      details: { username, email }
    });

    // Generate tokens
    const accessToken = authMiddleware.generateToken(user.id, { type: 'access' });
    const refreshToken = authMiddleware.generateRefreshToken(user.id);

    logger.info({ userId: user.id, username }, 'User registered successfully');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        publicKey: user.publicKey,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      email: req.body?.email,
      ip: req.ip
    }, 'Registration failed');

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
}

/**
 * Login user
 * POST /api/v1/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findByUsername(username);
    if (!user) {
      logger.warn({
        username,
        ip: req.ip
      }, 'Login failed - user not found');

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (user.status !== 'active') {
      logger.warn({
        userId: user.id,
        status: user.status,
        ip: req.ip
      }, 'Login failed - user inactive');

      return res.status(401).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Verify password
    const passwordMatch = await encryptionService.comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      logger.warn({
        userId: user.id,
        ip: req.ip
      }, 'Login failed - invalid password');

      // Log failed login attempt
      await auditService.logAction(user.id, 'LOGIN_FAILED', {
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        status: 'failed'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = authMiddleware.generateToken(user.id, { type: 'access' });
    const refreshToken = authMiddleware.generateRefreshToken(user.id);

    // Log successful login
    await auditService.logAction(user.id, 'LOGIN_SUCCESS', {
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      details: { username }
    });

    logger.info({
      userId: user.id,
      username,
      ip: req.ip
    }, 'User logged in successfully');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        publicKey: user.publicKey,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      username: req.body?.username,
      ip: req.ip
    }, 'Login failed');

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
}

/**
 * Refresh access token using refresh token
 * POST /api/v1/auth/refresh
 */
async function refreshToken(req, res) {
  try {
    const { refreshToken: tokenFromBody } = req.body;

    if (!tokenFromBody) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = require('jsonwebtoken').verify(
      tokenFromBody,
      require('../config/env').jwt.secret
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    // Generate new access token
    const accessToken = authMiddleware.generateToken(user.id, { type: 'access' });

    logger.info({ userId: user.id }, 'Access token refreshed');

    res.json({
      success: true,
      data: {
        accessToken
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      ip: req.ip
    }, 'Token refresh failed');

    res.status(401).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
}

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
async function logout(req, res) {
  try {
    const userId = req.user?.id;

    const token = req.headers.authorization?.split(' ')[1];

    if (!userId || !token) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Blacklist token in Redis
    try {
      const redisClient = require('../config/redis');
      const decoded = require('jsonwebtoken').decode(token);
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await redisClient.setEx(`bl_${token}`, expiresIn, 'revoked');
        }
      }
    } catch (redisErr) {
      logger.error({ error: redisErr.message }, 'Failed to blacklist token in Redis');
    }

    // Log logout action
    await auditService.logAction(userId, 'LOGOUT', {
      resourceType: 'user',
      resourceId: userId,
      ipAddress: req.ip
    });

    logger.info({ userId }, 'User logged out');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user?.id
    }, 'Logout failed');

    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
}

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
async function getProfile(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        publicKey: user.publicKey,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user?.id
    }, 'Failed to get profile');

    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
}

/**
 * Update user password
 * POST /api/v1/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Get user with password hash
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify old password
    const passwordMatch = await encryptionService.comparePassword(
      oldPassword,
      user.password_hash
    );

    if (!passwordMatch) {
      logger.warn({ userId }, 'Password change failed - invalid current password');

      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await encryptionService.hashPassword(newPassword);

    // Update password
    await User.update(userId, { passwordHash: newPasswordHash });

    // Log password change
    await auditService.logAction(userId, 'PASSWORD_CHANGED', {
      resourceType: 'user',
      resourceId: userId,
      ipAddress: req.ip
    });

    logger.info({ userId }, 'Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user?.id
    }, 'Password change failed');

    res.status(500).json({
      success: false,
      error: 'Password change failed'
    });
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  changePassword
};
