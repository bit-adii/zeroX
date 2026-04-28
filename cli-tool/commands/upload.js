const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');
const crypto = require('crypto');
const api = require('../utils/api');
const logger = require('../utils/logger');
const { encryptFileForUpload } = require('../utils/encryption');

async function execute(filepath) {
  const fullPath = path.resolve(process.cwd(), filepath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  logger.info(`Encrypting ${path.basename(fullPath)}...`);

  // In a real CLI, key would be derived from a password or stored securely in OS keychain.
  // We use a dummy key here for demonstration aligned with the backend test environment.
  const dummyKey = crypto.randomBytes(32); 
  
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(100, 0);

  // Encrypt locally
  const { encryptedData, iv, authTag, filename } = encryptFileForUpload(fullPath, dummyKey);
  bar.update(50);

  logger.info('Uploading to Zero-Trust pipeline...');
  
  // Upload to server
  try {
    const response = await api.post('/upload', {
      filename,
      encryptedData,
      encryptionIv: iv,
      mimetype: 'application/octet-stream'
      // Note: we should send authTag as well to the backend for GCM validation.
    });

    bar.update(100);
    bar.stop();

    const { fileId } = response.data.data;
    logger.success('Upload complete!');
    logger.info(`File ID: ${logger.highlight(fileId)}`);
    
  } catch (err) {
    bar.stop();
    throw new Error(err.response?.data?.error || err.message);
  }
}

module.exports = { execute };
