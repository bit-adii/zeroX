const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const {
  fileUploadSchema,
  paginationSchema,
  handleValidationErrors
} = require('../middleware/validation');

/**
 * All upload routes require authentication
 */

// POST /api/v1/upload - Upload file
router.post(
  '/',
  authMiddleware.authenticate,
  uploadLimiter,
  fileUploadSchema,
  handleValidationErrors,
  uploadController.uploadFile
);

// GET /api/v1/upload - List user's files
router.get(
  '/',
  authMiddleware.authenticate,
  paginationSchema,
  handleValidationErrors,
  uploadController.listFiles
);

// GET /api/v1/upload/:fileId - Get file info
router.get(
  '/:fileId',
  authMiddleware.authenticate,
  uploadController.getFileInfo
);

// GET /api/v1/upload/:fileId/download - Download encrypted file
router.get(
  '/:fileId/download',
  authMiddleware.authenticate,
  uploadController.downloadFile
);

// DELETE /api/v1/upload/:fileId - Delete file
router.delete(
  '/:fileId',
  authMiddleware.authenticate,
  uploadController.deleteFile
);

module.exports = router;
