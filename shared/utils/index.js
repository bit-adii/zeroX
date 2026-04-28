const crypto = require('crypto');

/**
 * Sanitize filename to prevent directory traversal attacks
 * @param {string} filename 
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename) return 'unnamed_file';
  return filename
    .replace(/[/\\]/g, '') // Remove slashes
    .replace(/\.\./g, '') // Remove parent dir references
    .replace(/\0/g, '') // Remove null bytes
    .trim() || 'unnamed_file';
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Retry a promise-based function with exponential backoff
 * @param {Function} fn - Function returning a promise
 * @param {number} maxAttempts - Max number of retries
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, maxAttempts = 3, initialDelay = 1000) {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts) throw error;
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay *= 2;
    }
  }
}

/**
 * Get SHA-256 hash of data
 * @param {Buffer|string} data 
 * @returns {string} Hex encoded hash
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  sanitizeFilename,
  formatBytes,
  retryWithBackoff,
  sha256
};
