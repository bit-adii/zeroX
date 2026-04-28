const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middleware/authMiddleware');
const { shareLimiter } = require('../middleware/rateLimiter');
const {
  fileShareSchema,
  handleValidationErrors
} = require('../middleware/validation');

/**
 * Create file share (authenticated)
 * POST /api/v1/share/:fileId
 */
router.post(
  '/:fileId',
  authMiddleware.authenticate,
  shareLimiter,
  fileShareSchema,
  handleValidationErrors,
  shareController.shareFile
);

/**
 * Get shared file - public endpoint (works with or without auth)
 * GET /api/v1/share/:shareId
 */
router.get(
  '/:shareId',
  authMiddleware.optionalAuth,
  shareController.getSharedFile
);

/**
 * Revoke share (owner only)
 * DELETE /api/v1/share/:shareId
 */
router.delete(
  '/:shareId',
  authMiddleware.authenticate,
  shareController.revokeShare
);

/**
 * List shares for a file (owner only)
 * GET /api/v1/upload/:fileId/shares
 */
router.get(
  '/list/:fileId',
  authMiddleware.authenticate,
  shareController.listShares
);

module.exports = router;
