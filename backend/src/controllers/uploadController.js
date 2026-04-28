const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { User, File } = require('../models/User');
const { encryptionService, storageService, auditService } = require('../services');
const { addJob } = require('../config/queue');
const config = require('../config/env');

/**
 * Upload encrypted file
 * POST /api/v1/upload
 */
async function uploadFile(req, res) {
  let fileId = null;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { filename, encryptedData, encryptionIv } = req.body;

    if (!filename || !encryptedData || !encryptionIv) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: filename, encryptedData, encryptionIv'
      });
    }

    // Validate file size
    const dataBuffer = Buffer.from(encryptedData, 'base64');
    if (dataBuffer.length > config.upload.maxFileSize) {
      logger.warn({
        userId,
        fileSize: dataBuffer.length,
        maxSize: config.upload.maxFileSize
      }, 'File upload rejected - size exceeds limit');

      return res.status(400).json({
        success: false,
        error: `File exceeds maximum size of ${config.upload.maxFileSize} bytes`
      });
    }

    // Save encrypted file to storage
    const { filePath, fileId: generatedFileId } = storageService.saveFile(
      encryptedData,
      null,
      { userId, filename }
    );

    fileId = generatedFileId;

    // Create file record in database
    const fileRecord = await File.create({
      userId,
      filename,
      originalFilename: filename,
      size: dataBuffer.length,
      mimetype: req.body.mimetype || 'application/octet-stream',
      encryptionIv,
      metadata: {
        uploadedAt: new Date().toISOString(),
        uploadIp: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Log file upload
    await auditService.logFileAccess(fileId, userId, 'UPLOAD', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { filename }
    });

    // Add processing job to queue if needed
    if (config.features.enableAuditLog) {
      await addJob('file-processing', {
        fileId: fileRecord.id,
        userId,
        action: 'analyze',
        metadata: {
          filename,
          size: dataBuffer.length
        }
      });
    }

    logger.info({
      fileId: fileRecord.id,
      userId,
      filename,
      size: dataBuffer.length
    }, 'File uploaded successfully');

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId: fileRecord.id,
        filename: fileRecord.original_filename,
        size: fileRecord.size,
        uploadedAt: fileRecord.created_at,
        encryptionIv: fileRecord.encryption_iv
      }
    });
  } catch (error) {
    // Clean up file if database operation failed
    if (fileId) {
      try {
        storageService.deleteFile(fileId);
      } catch (cleanupError) {
        logger.error({ error: cleanupError.message, fileId }, 'Failed to clean up file');
      }
    }

    logger.error({
      error: error.message,
      userId: req.user?.id,
      filename: req.body?.filename
    }, 'File upload failed');

    res.status(500).json({
      success: false,
      error: 'File upload failed'
    });
  }
}

/**
 * Get file info (metadata only, not content)
 * GET /api/v1/upload/:fileId
 */
async function getFileInfo(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Find file
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check ownership (unless admin)
    if (file.user_id !== userId && req.user.role !== 'admin') {
      logger.warn({
        userId,
        fileId,
        fileOwner: file.user_id
      }, 'Unauthorized file access attempt');

      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this file'
      });
    }

    // Log file access
    await auditService.logFileAccess(fileId, userId, 'INFO_VIEW', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        fileId: file.id,
        filename: file.original_filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: file.created_at,
        updatedAt: file.updated_at,
        encryptionIv: file.encryption_iv
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.id
    }, 'Failed to get file info');

    res.status(500).json({
      success: false,
      error: 'Failed to get file info'
    });
  }
}

/**
 * Download encrypted file
 * GET /api/v1/upload/:fileId/download
 */
async function downloadFile(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Find file
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check ownership or share permission
    if (file.user_id !== userId && req.user.role !== 'admin') {
      logger.warn({
        userId,
        fileId,
        fileOwner: file.user_id
      }, 'Unauthorized download attempt');

      return res.status(403).json({
        success: false,
        error: 'You do not have permission to download this file'
      });
    }

    // Read encrypted file
    const encryptedData = storageService.readFile(fileId);

    // Log file download
    await auditService.logFileAccess(fileId, userId, 'DOWNLOAD', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.debug({
      fileId,
      userId,
      filename: file.original_filename
    }, 'File downloaded');

    // Return encrypted data with IV
    res.json({
      success: true,
      data: {
        fileId: file.id,
        filename: file.original_filename,
        encryptedData: encryptedData.toString('base64'),
        encryptionIv: file.encryption_iv,
        size: file.size,
        mimetype: file.mimetype
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.id
    }, 'File download failed');

    res.status(500).json({
      success: false,
      error: 'File download failed'
    });
  }
}

/**
 * Delete file
 * DELETE /api/v1/upload/:fileId
 */
async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Find file
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Check ownership
    if (file.user_id !== userId && req.user.role !== 'admin') {
      logger.warn({
        userId,
        fileId,
        fileOwner: file.user_id
      }, 'Unauthorized delete attempt');

      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this file'
      });
    }

    // Delete from storage
    storageService.deleteFile(fileId);

    // Delete from database
    await File.delete(fileId);

    // Log deletion
    await auditService.logFileAccess(fileId, userId, 'DELETE', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    logger.info({
      fileId,
      userId,
      filename: file.original_filename
    }, 'File deleted');

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error({
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.id
    }, 'File deletion failed');

    res.status(500).json({
      success: false,
      error: 'File deletion failed'
    });
  }
}

/**
 * List user's files
 * GET /api/v1/upload
 */
async function listFiles(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { limit = 50, offset = 0 } = req.query;

    // Get user's files
    const files = await File.findByUser(userId, {
      limit: Math.min(limit, 100),
      offset
    });

    logger.debug({
      userId,
      fileCount: files.length
    }, 'Files listed');

    res.json({
      success: true,
      data: {
        files: files.map(file => ({
          fileId: file.id,
          filename: file.original_filename,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: file.created_at,
          encryptionIv: file.encryption_iv
        })),
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user?.id
    }, 'Failed to list files');

    res.status(500).json({
      success: false,
      error: 'Failed to list files'
    });
  }
}

module.exports = {
  uploadFile,
  getFileInfo,
  downloadFile,
  deleteFile,
  listFiles
};
