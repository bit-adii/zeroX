const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  createUserSchema,
  loginSchema,
  handleValidationErrors
} = require('../middleware/validation');

/**
 * Public routes (no authentication required)
 */

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  createUserSchema,
  handleValidationErrors,
  authController.register
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  loginSchema,
  handleValidationErrors,
  authController.login
);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refreshToken);

/**
 * Protected routes (authentication required)
 */

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware.authenticate, authController.logout);

// GET /api/v1/auth/me
router.get('/me', authMiddleware.authenticate, authController.getProfile);

// POST /api/v1/auth/change-password
router.post(
  '/change-password',
  authMiddleware.authenticate,
  authController.changePassword
);

module.exports = router;
