import { ipcMain } from 'electron';
import crypto from 'crypto';

/**
 * Register encryption/cryptography IPC handlers
 */
export default function registerEncryptionHandlers() {
  // Generate RSA key pair
  ipcMain.handle('generate-keypair', async () => {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      return {
        publicKey,
        privateKey,
      };
    } catch (error) {
      console.error('Key pair generation error:', error);
      throw error;
    }
  });

  // Hash data with SHA256
  ipcMain.handle('hash:sha256', async (event, data) => {
    try {
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      return { hash };
    } catch (error) {
      console.error('SHA256 hashing error:', error);
      return { error: error.message };
    }
  });

  // Generate random bytes
  ipcMain.handle('crypto:random-bytes', async (event, length) => {
    try {
      const bytes = crypto.randomBytes(length).toString('hex');
      return { bytes };
    } catch (error) {
      console.error('Random bytes generation error:', error);
      return { error: error.message };
    }
  });

  // Encrypt RSA
  ipcMain.handle('crypto:encrypt-rsa', async (event, { data, publicKey }) => {
    try {
      const buffer = Buffer.from(data);
      const encrypted = crypto.publicEncrypt(publicKey, buffer);
      return { encrypted: encrypted.toString('base64') };
    } catch (error) {
      console.error('RSA encryption error:', error);
      return { error: error.message };
    }
  });

  // Decrypt RSA
  ipcMain.handle('crypto:decrypt-rsa', async (event, { data, privateKey }) => {
    try {
      const buffer = Buffer.from(data, 'base64');
      const decrypted = crypto.privateDecrypt(privateKey, buffer);
      return { decrypted: decrypted.toString() };
    } catch (error) {
      console.error('RSA decryption error:', error);
      return { error: error.message };
    }
  });
}
