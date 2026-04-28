const crypto = require('crypto');

/**
 * Generate 4096-bit RSA Key Pair
 * @returns {Object} { publicKey: PEM string, privateKey: PEM string }
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096, // Upgraded from 2048 for better security
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

/**
 * Encrypt data using RSA-OAEP
 * @param {Buffer|string} data - Data to encrypt
 * @param {string} publicKey - PEM encoded public key
 * @returns {string} Base64 encoded encrypted data
 */
function encryptRSA(data, publicKey) {
  const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  
  const encrypted = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, bufferData);
  
  return encrypted.toString('base64');
}

/**
 * Decrypt data using RSA-OAEP
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} privateKey - PEM encoded private key
 * @returns {Buffer} Decrypted data buffer
 */
function decryptRSA(encryptedData, privateKey) {
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  
  return crypto.privateDecrypt({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, encryptedBuffer);
}

module.exports = { generateKeyPair, encryptRSA, decryptRSA };