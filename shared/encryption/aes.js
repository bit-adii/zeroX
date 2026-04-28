const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is standard for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes auth tag

/**
 * Encrypt data using AES-256-GCM
 * @param {Buffer|string} data - Data to encrypt
 * @param {Buffer|string} key - 32-byte encryption key (Buffer or Hex string)
 * @returns {Object} { iv: base64, authTag: base64, data: base64 }
 */
function encryptAES(data, key) {
  const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid key length. Must be 32 bytes for AES-256.');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  const encrypted = Buffer.concat([cipher.update(bufferData), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {Buffer|string} key - 32-byte encryption key (Buffer or Hex string)
 * @param {string} iv - Base64 encoded Initialization Vector
 * @param {string} authTag - Base64 encoded Authentication Tag
 * @returns {Buffer} Decrypted data
 */
function decryptAES(encryptedData, key, iv, authTag) {
  if (!authTag) {
    throw new Error('Authentication tag is required for AES-GCM decryption');
  }

  const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('Invalid key length. Must be 32 bytes for AES-256.');
  }

  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);
    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed: Data may have been tampered with or key is incorrect.');
  }
}

module.exports = { encryptAES, decryptAES, ALGORITHM };