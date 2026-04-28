import { ipcMain } from 'electron';
import Store from 'electron-store';

// Initialize secure store with encryption if possible, or basic store
const store = new Store({
  name: 'secure-credentials',
  encryptionKey: 'local-machine-unique-key-would-go-here' // In production, use keytar
});

/**
 * Register authentication IPC handlers
 */
export default function registerAuthHandlers() {
  ipcMain.handle('auth:login', async (event, credentials) => {
    try {
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password are required');
      }
      
      // Store locally (usually you'd store the token, not password)
      store.set('username', credentials.username);
      
      return { success: true };
    } catch (error) {
      console.error('Auth error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      store.clear();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:get-credentials', async () => {
    try {
      const username = store.get('username');
      return { success: true, credentials: username ? { username } : null };
    } catch (error) {
      console.error('Get credentials error:', error);
      return { success: false, error: error.message };
    }
  });
}
