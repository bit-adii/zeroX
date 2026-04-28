const crypto = require('crypto');

/**
 * Generate a random 256-bit (32 bytes) AES key
 * @returns {Buffer} 32-byte key
 */
function generateAESKey() {
  return crypto.randomBytes(32);
}

/**
 * Generate a random salt for key derivation
 * @param {number} length - Salt length (default 16 bytes)
 * @returns {string} Hex encoded salt
 */
function generateSalt(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Derive a 256-bit AES key from a password using PBKDF2
 * @param {string} password - User password
 * @param {string} salt - Hex encoded salt
 * @param {number} iterations - PBKDF2 iterations (default 100000)
 * @returns {Promise<Buffer>} Derived 32-byte key
 */
function deriveKeyFromPassword(password, salt, iterations = 100000) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

module.exports = { 
  generateAESKey, 
  generateSalt, 
  deriveKeyFromPassword 
};
