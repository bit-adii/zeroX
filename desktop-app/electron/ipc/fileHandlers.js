import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

const MAX_RAM_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Register file operation IPC handlers
 */
export default function registerFileHandlers() {
  // Select file for upload
  ipcMain.handle('file:select-for-upload', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
        ],
      });

      if (result.canceled) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const fileName = path.basename(filePath);
      const fileSize = fs.statSync(filePath).size;
      const mimeType = getMimeType(filePath);

      if (fileSize > MAX_RAM_FILE_SIZE) {
        return { success: false, error: `File too large (${(fileSize/1024/1024).toFixed(1)}MB). Max supported in this version is 50MB.` };
      }

      const fileContent = fs.readFileSync(filePath);

      return {
        canceled: false,
        filePath,
        fileName,
        fileSize,
        fileContent: Buffer.from(fileContent),
        mimeType,
        success: true
      };
    } catch (error) {
      console.error('File selection error:', error);
      return { success: false, error: error.message };
    }
  });

  // Save file to disk (for download)
  ipcMain.handle('file:save-file', async (event, { fileName, fileContent }) => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: fileName,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });

      if (result.canceled) {
        return { canceled: true };
      }

      fs.writeFileSync(result.filePath, fileContent);

      return {
        canceled: false,
        filePath: result.filePath,
        success: true,
      };
    } catch (error) {
      console.error('File save error:', error);
      return { success: false, error: error.message };
    }
  });

  // Open file location
  ipcMain.handle('file:open-location', async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const dirPath = path.dirname(filePath);
      import('electron').then(({ shell }) => shell.showItemInFolder(filePath));

      return { success: true };
    } catch (error) {
      console.error('Open location error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get file size
  ipcMain.handle('file:get-size', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return { success: true, size: stats.size };
    } catch (error) {
      console.error('Get file size error:', error);
      return { success: false, error: error.message };
    }
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.json': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
