/**
 * JSDoc type definitions for the Zero-Trust system
 */

/**
 * @typedef {Object} UserRecord
 * @property {string} id - UUID
 * @property {string} username - Unique username
 * @property {string} email - Unique email
 * @property {string} passwordHash - Hashed password
 * @property {string} publicKey - RSA Public Key
 * @property {string} [privateKeyEncrypted] - AES-encrypted RSA Private Key
 * @property {string} role - User role (admin|user)
 * @property {string} status - Account status
 * @property {Object} metadata - Additional info
 */

/**
 * @typedef {Object} FileRecord
 * @property {string} id - UUID
 * @property {string} userId - Owner's UUID
 * @property {string} filename - Secure filename
 * @property {string} originalFilename - Original filename before upload
 * @property {number} size - File size in bytes
 * @property {string} mimetype - File MIME type
 * @property {string} encryptionIv - Base64 encoded Initialization Vector for AES
 * @property {Object} metadata - File metadata (uploadedAt, etc.)
 */

/**
 * @typedef {Object} ShareRecord
 * @property {string} id - UUID
 * @property {string} fileId - Shared file UUID
 * @property {string} ownerId - Owner's UUID
 * @property {string} recipientEmail - Recipient's email address
 * @property {string} encryptedKey - AES key encrypted with recipient's public RSA key
 * @property {number|null} expiresAt - Timestamp when the share expires
 * @property {string} accessLevel - view or download
 */

module.exports = {};
