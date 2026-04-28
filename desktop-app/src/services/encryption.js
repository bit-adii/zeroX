/**
 * Client-side encryption service using Web Crypto API
 * Encrypts files before upload, decrypts after download
 */
class EncryptionService {
  constructor() {
    this.algorithm = { name: 'AES-GCM', length: 256 };
  }

  /**
   * Helper to convert hex to Uint8Array
   */
  _hexToBuffer(hex) {
    const bytes = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Helper to convert buffer to base64
   */
  _bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Generate a random encryption key (hex)
   */
  generateKey() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encrypt file with AES-256-GCM
   * @param {Uint8Array} fileBuffer - File data
   * @param {string} keyHex - Encryption key (hex)
   * @returns {Object} { encryptedData, iv } base64 encoded
   */
  async encryptFile(fileBuffer, keyHex) {
    try {
      const keyData = this._hexToBuffer(keyHex);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        false,
        ['encrypt']
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        fileBuffer
      );

      // Extract Auth Tag (last 16 bytes) and Ciphertext
      // Our backend AES-GCM expects iv, authTag, and data separately, but window.crypto appends authTag to ciphertext.
      // So we split them here for backend compatibility.
      const encryptedBytes = new Uint8Array(encryptedBuffer);
      const data = encryptedBytes.slice(0, encryptedBytes.length - 16);
      const authTag = encryptedBytes.slice(encryptedBytes.length - 16);

      return {
        encryptedData: this._bufferToBase64(data),
        iv: this._bufferToBase64(iv),
        authTag: this._bufferToBase64(authTag)
      };
    } catch (error) {
      console.error('File encryption failed:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file with AES-256-GCM
   */
  async decryptFile(encryptedDataB64, keyHex, ivB64, authTagB64) {
    try {
      const keyData = this._hexToBuffer(keyHex);
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        false,
        ['decrypt']
      );

      const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
      const authTag = Uint8Array.from(atob(authTagB64), c => c.charCodeAt(0));
      const encryptedData = Uint8Array.from(atob(encryptedDataB64), c => c.charCodeAt(0));

      // Combine ciphertext and authTag for window.crypto.subtle
      const combined = new Uint8Array(encryptedData.length + authTag.length);
      combined.set(encryptedData);
      combined.set(authTag, encryptedData.length);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        combined
      );

      return new Uint8Array(decryptedBuffer);
    } catch (error) {
      console.error('File decryption failed:', error);
      throw new Error('Failed to decrypt file: Invalid key or corrupted data');
    }
  }

  async generateKeyPair(ipcInvoke) {
    try {
      return await ipcInvoke('generate-keypair');
    } catch (error) {
      console.error('Key pair generation failed:', error);
      throw error;
    }
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  validatePasswordStrength(password) {
    const errors = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letters');
    if (!/\d/.test(password)) errors.push('Password must contain numbers');
    if (!/[@$!%*?&]/.test(password)) errors.push('Password must contain special characters (@$!%*?&)');
    
    return { valid: errors.length === 0, errors };
  }
}

export default new EncryptionService();
