const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createReadStream, createWriteStream } = require('fs');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const config = require('../config/env');

/**
 * Ensure upload directory exists with secure permissions
 */
function ensureUploadDir() {
  if (!fs.existsSync(config.upload.uploadDir)) {
    fs.mkdirSync(config.upload.uploadDir, { recursive: true, mode: 0o700 });
    logger.info({ uploadDir: config.upload.uploadDir }, 'Upload directory created');
  }
}

/**
 * Save encrypted file to disk with validation
 * @param {Buffer|string} fileData - Encrypted file data (base64 string or Buffer)
 * @param {string} fileId - Unique file identifier
 * @param {Object} metadata - File metadata
 * @returns {Object} { filePath, fileId, size }
 */
function saveFile(fileData, fileId = null, metadata = {}) {
  try {
    ensureUploadDir();

    // Validate input
    if (!fileData) {
      throw new Error('File data is required');
    }

    // Generate fileId if not provided
    const id = fileId || uuidv4();

    // Validate fileId format
    if (!/^[a-f0-9-]+$/i.test(id)) {
      throw new Error('Invalid file ID format');
    }

    // Convert base64 string to Buffer if needed
    let buffer = fileData;
    if (typeof fileData === 'string') {
      try {
        buffer = Buffer.from(fileData, 'base64');
      } catch (error) {
        throw new Error('Invalid base64 file data');
      }
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new Error('File data must be Buffer or base64 string');
    }

    // Validate file size
    if (buffer.length > config.upload.maxFileSize) {
      throw new Error(`File exceeds maximum size of ${config.upload.maxFileSize} bytes`);
    }

    if (buffer.length === 0) {
      throw new Error('File is empty');
    }

    // Save with secure filename (no path traversal)
    const filePath = path.join(config.upload.uploadDir, `${id}.enc`);
    const normalizedPath = path.normalize(filePath);

    // Verify path is within upload directory
    if (!normalizedPath.startsWith(path.normalize(config.upload.uploadDir))) {
      throw new Error('Invalid file path');
    }

    // Write file with restricted permissions
    fs.writeFileSync(filePath, buffer, { mode: 0o600 });

    logger.info({
      fileId: id,
      size: buffer.length,
      path: normalizedPath,
      metadata
    }, 'File saved successfully');

    return {
      filePath: normalizedPath,
      fileId: id,
      size: buffer.length
    };
  } catch (error) {
    logger.error({
      error: error.message,
      fileId,
      dataSize: fileData?.length || 0
    }, 'File save failed');
    throw error;
  }
}

/**
 * Read encrypted file from disk
 * @param {string} fileId - File ID
 * @returns {Buffer} Encrypted file data
 */
function readFile(fileId) {
  try {
    // Validate fileId format
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      throw new Error('Invalid file ID format');
    }

    ensureUploadDir();
    const filePath = path.join(config.upload.uploadDir, `${fileId}.enc`);
    const normalizedPath = path.normalize(filePath);

    // Verify path is within upload directory
    if (!normalizedPath.startsWith(path.normalize(config.upload.uploadDir))) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    const buffer = fs.readFileSync(normalizedPath);
    logger.debug({ fileId, size: buffer.length }, 'File read successfully');
    return buffer;
  } catch (error) {
    logger.error({
      error: error.message,
      fileId
    }, 'File read failed');
    throw error;
  }
}

/**
 * Stream file for efficient large file handling
 * @param {string} fileId - File ID
 * @returns {ReadStream} File stream
 */
function createFileReadStream(fileId) {
  try {
    // Validate fileId format
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      throw new Error('Invalid file ID format');
    }

    ensureUploadDir();
    const filePath = path.join(config.upload.uploadDir, `${fileId}.enc`);
    const normalizedPath = path.normalize(filePath);

    // Verify path is within upload directory
    if (!normalizedPath.startsWith(path.normalize(config.upload.uploadDir))) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    const stream = createReadStream(normalizedPath, { highWaterMark: config.upload.chunkSize });
    logger.debug({ fileId }, 'File stream created');
    return stream;
  } catch (error) {
    logger.error({
      error: error.message,
      fileId
    }, 'Stream creation failed');
    throw error;
  }
}

/**
 * Delete encrypted file from disk
 * @param {string} fileId - File ID
 * @returns {boolean} Success status
 */
function deleteFile(fileId) {
  try {
    // Validate fileId format
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      throw new Error('Invalid file ID format');
    }

    ensureUploadDir();
    const filePath = path.join(config.upload.uploadDir, `${fileId}.enc`);
    const normalizedPath = path.normalize(filePath);

    // Verify path is within upload directory
    if (!normalizedPath.startsWith(path.normalize(config.upload.uploadDir))) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(normalizedPath)) {
      logger.warn({ fileId }, 'File not found for deletion');
      return false;
    }

    fs.unlinkSync(normalizedPath);
    logger.info({ fileId }, 'File deleted successfully');
    return true;
  } catch (error) {
    logger.error({
      error: error.message,
      fileId
    }, 'File deletion failed');
    throw error;
  }
}

/**
 * Get file stats without exposing full content
 * @param {string} fileId - File ID
 * @returns {Object} File stats
 */
function getFileStats(fileId) {
  try {
    // Validate fileId format
    if (!/^[a-f0-9-]+$/i.test(fileId)) {
      throw new Error('Invalid file ID format');
    }

    ensureUploadDir();
    const filePath = path.join(config.upload.uploadDir, `${fileId}.enc`);
    const normalizedPath = path.normalize(filePath);

    // Verify path is within upload directory
    if (!normalizedPath.startsWith(path.normalize(config.upload.uploadDir))) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(normalizedPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    const stats = fs.statSync(normalizedPath);
    logger.debug({ fileId, size: stats.size }, 'File stats retrieved');

    return {
      fileId,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime
    };
  } catch (error) {
    logger.error({
      error: error.message,
      fileId
    }, 'Failed to get file stats');
    throw error;
  }
}

module.exports = {
  saveFile,
  readFile,
  createFileReadStream,
  deleteFile,
  getFileStats
};