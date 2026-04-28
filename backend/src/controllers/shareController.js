const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { User, File } = require('../models/User');
const auditService = require('../services/auditService');
const { getDatabase } = require('../config/db');
const config = require('../config/env');

/**
 * Create file share link
 * POST /api/v1/share/:fileId
 */
async function shareFile(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;
    const { recipientEmail, accessLevel = 'view', expiresIn } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Validate input
    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email is required'
      });
    }

    if (!['view', 'download'].includes(accessLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Access level must be "view" or "download"'
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
    if (file.user_id !== userId) {
      logger.warn({
        userId,
        fileId,
        fileOwner: file.user_id
      }, 'Unauthorized share attempt');

      return res.status(403).json({
        success: false,
        error: 'You can only share your own files'
      });
    }

    let encryptedKeyPayload = null;
    let ivPayload = null;
    let authTagPayload = null;

    if (recipient && recipient.publicKey) {
      // Encrypt AES key for recipient's public key
      const encryptionService = require('../services/encryptionService');
      const encryptedData = encryptionService.encryptForUser(
        config.encryption.key.toString('hex'),
        recipient.publicKey
      );
      encryptedKeyPayload = encryptedData.encryptedKey;
      ivPayload = encryptedData.iv;
      authTagPayload = encryptedData.authTag;
    } else {
      // Non-registered user. In a real app, send an email invite.
      // For now, we will store a placeholder or require them to register.
      logger.info({
        userId,
        recipientEmail,
        fileId
      }, 'Sharing file with non-registered user. Requires registration.');
      encryptedKeyPayload = 'PENDING_REGISTRATION';
    }

    // Create share record
    const db = getDatabase();
    const shareId = uuidv4();
    const now = Date.now();
    const expiresAt = expiresIn ? now + (expiresIn * 1000) : null;

    await db.run(
      `INSERT INTO file_shares 
       (id, file_id, owner_id, recipient_email, encrypted_key, expires_at, access_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shareId,
        fileId,
        userId,
        recipientEmail,
        encryptedKeyPayload,
        expiresAt,
        accessLevel,
        now,
        now
      ]
    );

    // Log share action
    await auditService.logAction(userId, 'FILE_SHARED', {
      resourceType: 'file',
      resourceId: fileId,
      ipAddress: req.ip,
      details: {
        shareId,
        recipientEmail,
        accessLevel,
        expiresAt
      }
    });

    logger.info({
      shareId,
      fileId,
      userId,
      recipientEmail,
      accessLevel
    }, 'File shared successfully');

    res.status(201).json({
      success: true,
      message: 'File shared successfully',
      data: {
        shareId,
        fileId,
        recipientEmail,
        accessLevel,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        encryptedKey: encryptedKey.encryptedKey,
        iv: encryptedKey.iv
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.id,
      recipientEmail: req.body?.recipientEmail
    }, 'File sharing failed');

    res.status(500).json({
      success: false,
      error: 'File sharing failed'
    });
  }
}

/**
 * Get shared file (check share validity and return metadata + encrypted key)
 * GET /api/v1/share/:shareId
 */
async function getSharedFile(req, res) {
  try {
    const { shareId } = req.params;

    const db = getDatabase();
    const share = await db.get(
      `SELECT * FROM file_shares WHERE id = ?`,
      [shareId]
    );

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    // Check if share has expired
    if (share.expires_at && share.expires_at < Date.now()) {
      logger.warn({
        shareId,
        expiredAt: new Date(share.expires_at)
      }, 'Accessing expired share');

      return res.status(403).json({
        success: false,
        error: 'This share link has expired'
      });
    }

    // Get file info
    const file = await File.findById(share.file_id);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'Shared file not found'
      });
    }

    // Log share access
    const userId = req.user?.id;
    if (userId) {
      await auditService.logAction(userId, 'SHARED_FILE_ACCESSED', {
        resourceType: 'share',
        resourceId: shareId,
        ipAddress: req.ip,
        details: { fileId: share.file_id }
      });
    }

    logger.debug({
      shareId,
      fileId: share.file_id,
      accessLevel: share.access_level
    }, 'Shared file accessed');

    res.json({
      success: true,
      data: {
        shareId,
        fileId: file.id,
        filename: file.original_filename,
        size: file.size,
        mimetype: file.mimetype,
        accessLevel: share.access_level,
        uploadedBy: share.owner_id,
        sharedAt: new Date(share.created_at),
        expiresAt: share.expires_at ? new Date(share.expires_at) : null,
        encryptedKey: share.encrypted_key,
        encryptionIv: file.encryption_iv
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      shareId: req.params.shareId
    }, 'Failed to get shared file');

    res.status(500).json({
      success: false,
      error: 'Failed to get shared file'
    });
  }
}

/**
 * Revoke share link
 * DELETE /api/v1/share/:shareId
 */
async function revokeShare(req, res) {
  try {
    const { shareId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const db = getDatabase();
    const share = await db.get(
      `SELECT * FROM file_shares WHERE id = ?`,
      [shareId]
    );

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    // Check ownership
    if (share.owner_id !== userId && req.user.role !== 'admin') {
      logger.warn({
        userId,
        shareId,
        shareOwner: share.owner_id
      }, 'Unauthorized revoke attempt');

      return res.status(403).json({
        success: false,
        error: 'You can only revoke your own shares'
      });
    }

    // Delete share
    await db.run('DELETE FROM file_shares WHERE id = ?', [shareId]);

    // Log revocation
    await auditService.logAction(userId, 'SHARE_REVOKED', {
      resourceType: 'share',
      resourceId: shareId,
      ipAddress: req.ip,
      details: { fileId: share.file_id }
    });

    logger.info({
      shareId,
      fileId: share.file_id,
      userId
    }, 'Share revoked');

    res.json({
      success: true,
      message: 'Share revoked successfully'
    });
  } catch (error) {
    logger.error({
      error: error.message,
      shareId: req.params.shareId,
      userId: req.user?.id
    }, 'Failed to revoke share');

    res.status(500).json({
      success: false,
      error: 'Failed to revoke share'
    });
  }
}

/**
 * List shares for a file (owner only)
 * GET /api/v1/upload/:fileId/shares
 */
async function listShares(req, res) {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Verify file ownership
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    if (file.user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You can only view shares for your own files'
      });
    }

    // Get shares
    const db = getDatabase();
    const shares = await db.all(
      `SELECT id, recipient_email, access_level, expires_at, created_at 
       FROM file_shares 
       WHERE file_id = ? 
       ORDER BY created_at DESC`,
      [fileId]
    );

    logger.debug({
      fileId,
      userId,
      shareCount: shares?.length || 0
    }, 'Shares listed');

    res.json({
      success: true,
      data: {
        fileId,
        shares: (shares || []).map(share => ({
          shareId: share.id,
          recipientEmail: share.recipient_email,
          accessLevel: share.access_level,
          sharedAt: new Date(share.created_at),
          expiresAt: share.expires_at ? new Date(share.expires_at) : null,
          isExpired: share.expires_at && share.expires_at < Date.now()
        }))
      }
    });
  } catch (error) {
    logger.error({
      error: error.message,
      fileId: req.params.fileId,
      userId: req.user?.id
    }, 'Failed to list shares');

    res.status(500).json({
      success: false,
      error: 'Failed to list shares'
    });
  }
}

module.exports = {
  shareFile,
  getSharedFile,
  revokeShare,
  listShares
};
