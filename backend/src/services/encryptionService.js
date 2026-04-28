const crypto = require('crypto');
const { encryptAES, decryptAES } = require('../../../shared/encryption/aes');
const { encryptRSA, decryptRSA, generateKeyPair } = require('../../../shared/encryption/rsa');
const { logger } = require('../utils/logger');
const config = require('../config/env');

/**
 * Encrypt file buffer with AES-256-GCM
 * @param {Buffer} fileBuffer - File data to encrypt
 * @returns {Object} { iv, authTag, encryptedData } - All base64 encoded
 */
function encryptFile(fileBuffer) {
  try {
    if (!Buffer.isBuffer(fileBuffer)) {
      throw new Error('Input must be a Buffer');
    }

    const result = encryptAES(fileBuffer, config.encryption.key);
    logger.debug({ size: fileBuffer.length, ivLength: result.iv.length }, 'File encrypted successfully');
    return result;
  } catch (error) {
    logger.error({ error: error.message }, 'File encryption failed');
    throw error;
  }
}

/**
 * Decrypt file with previously stored IV and Auth Tag
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} iv - Base64 encoded IV
 * @param {string} authTag - Base64 encoded Auth Tag
 * @returns {Buffer} Decrypted file buffer
 */
function decryptFile(encryptedData, iv, authTag) {
  try {
    if (typeof encryptedData !== 'string' || typeof iv !== 'string' || typeof authTag !== 'string') {
      throw new Error('Encrypted data, IV, and authTag must be base64 strings');
    }

    const decrypted = decryptAES(encryptedData, config.encryption.key, iv, authTag);
    logger.debug({ size: decrypted.length }, 'File decrypted successfully');
    return decrypted;
  } catch (error) {
    logger.error({ error: error.message }, 'File decryption failed');
    throw error;
  }
}

/**
 * Encrypt data for user (RSA-based key exchange, AES for payload)
 * @param {*} data - Data to encrypt
 * @param {string} publicKey - RSA public key (PEM format)
 * @returns {Object} { encryptedData, encryptedKey, iv, authTag }
 */
function encryptForUser(data, publicKey) {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBuffer = Buffer.from(dataString, 'utf8');

    // Generate random ephemeral AES key for this specific payload
    const ephemeralKey = crypto.randomBytes(32);
    
    // Encrypt data with ephemeral AES key
    const { iv, authTag, data: encryptedData } = encryptAES(dataBuffer, ephemeralKey);

    // Encrypt ephemeral AES key with user's RSA public key
    const encryptedKey = encryptRSA(ephemeralKey.toString('hex'), publicKey);

    logger.debug({ dataSize: dataString.length }, 'Data encrypted for user');

    return {
      encryptedData,
      encryptedKey,
      iv,
      authTag
    };
  } catch (error) {
    logger.error({ error: error.message }, 'User encryption failed');
    throw error;
  }
}

/**
 * Decrypt data that was encrypted with encryptForUser
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptedKey - Base64 encoded encrypted AES key
 * @param {string} iv - Base64 encoded IV
 * @param {string} authTag - Base64 encoded auth tag
 * @param {string} privateKey - RSA private key (PEM format)
 * @returns {Buffer} Decrypted data
 */
function decryptForUser(encryptedData, encryptedKey, iv, authTag, privateKey) {
  try {
    // Decrypt ephemeral AES key with user's RSA private key
    const decryptedKeyHex = decryptRSA(encryptedKey, privateKey);
    const aesKey = Buffer.from(decryptedKeyHex, 'hex');

    // Decrypt data with recovered AES key
    const decrypted = decryptAES(encryptedData, aesKey, iv, authTag);

    logger.debug({ size: decrypted.length }, 'User data decrypted successfully');
    return decrypted;
  } catch (error) {
    logger.error({ error: error.message }, 'User decryption failed');
    throw error;
  }
}

/**
 * Generate RSA key pair for user
 * @returns {Object} { publicKey, privateKey }
 */
function generateUserKeyPair() {
  try {
    const { publicKey, privateKey } = generateKeyPair();
    logger.info('User key pair generated');
    return { publicKey, privateKey };
  } catch (error) {
    logger.error({ error: error.message }, 'Key pair generation failed');
    throw error;
  }
}

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  const bcrypt = require('bcryptjs');
  try {
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    logger.debug('Password hashed successfully');
    return hashed;
  } catch (error) {
    logger.error({ error: error.message }, 'Password hashing failed');
    throw error;
  }
}

/**
 * Compare plain password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Password hash
 * @returns {Promise<boolean>} True if matches
 */
async function comparePassword(password, hash) {
  const bcrypt = require('bcryptjs');
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error({ error: error.message }, 'Password comparison failed');
    return false;
  }
}

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Hex encoded token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  encryptFile,
  decryptFile,
  encryptForUser,
  decryptForUser,
  generateUserKeyPair,
  hashPassword,
  comparePassword,
  generateToken
};
