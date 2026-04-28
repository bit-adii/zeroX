const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a file buffer for upload
 * @param {string} filePath - Path to file
 * @param {Buffer} key - 32-byte encryption key
 * @returns {Object} { encryptedData: base64, iv: base64, authTag: base64, size: number, filename: string }
 */
function encryptFileForUpload(filePath, key) {
  const fileBuffer = fs.readFileSync(filePath);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    size: fileBuffer.length,
    filename: path.basename(filePath)
  };
}

module.exports = {
  encryptFileForUpload
};
