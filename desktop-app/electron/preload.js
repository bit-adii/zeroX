import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose secure APIs to renderer process
 * Following the principle of least privilege
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth IPC
  authLogin: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  getCredentials: () => ipcRenderer.invoke('auth:get-credentials'),

  // File IPC
  selectFile: () => ipcRenderer.invoke('file:select-for-upload'),
  saveFile: (data) => ipcRenderer.invoke('file:save-file', data),
  openFileLocation: (filePath) => ipcRenderer.invoke('file:open-location', filePath),
  getFileSize: (filePath) => ipcRenderer.invoke('file:get-size', filePath),

  // Crypto IPC
  generateKeyPair: () => ipcRenderer.invoke('generate-keypair'),
  sha256: (data) => ipcRenderer.invoke('hash:sha256', data),
  randomBytes: (length) => ipcRenderer.invoke('crypto:random-bytes', length),
  encryptRSA: (data, publicKey) =>
    ipcRenderer.invoke('crypto:encrypt-rsa', { data, publicKey }),
  decryptRSA: (data, privateKey) =>
    ipcRenderer.invoke('crypto:decrypt-rsa', { data, privateKey }),
});

// Prevent dangerous APIs
delete window.eval;
delete window.Function;
