const crypto = require('crypto');

/**
 * Generate random string
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain lowercase letters' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain uppercase letters' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain numbers' };
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, error: 'Password must contain special characters (@$!%*?&)' };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/^\.+/, '') // Remove leading dots
    .trim();
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if IP is in CIDR range
 */
function ipInCIDR(ip, cidr) {
  const [cidrIp, bits] = cidr.split('/');
  const ipNum = ipToNumber(ip);
  const cidrNum = ipToNumber(cidrIp);
  const mask = -1 << (32 - bits);
  
  return (ipNum & mask) === (cidrNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip) {
  const parts = ip.split('.');
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0);
}

/**
 * Generate pagination metadata
 */
function getPaginationMetadata(limit, offset, total) {
  return {
    limit,
    offset,
    total,
    pages: Math.ceil(total / limit),
    currentPage: Math.floor(offset / limit) + 1
  };
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Retry execution with exponential backoff
 */
async function retryWithBackoff(
  fn,
  maxAttempts = 3,
  initialDelay = 1000,
  maxDelay = 30000
) {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      if (attempt >= maxAttempts) {
        throw error;
      }

      // Calculate exponential backoff with jitter
      delay = Math.min(delay * 2, maxDelay);
      const jitter = Math.random() * delay * 0.1;
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
}

/**
 * Check if file extension is allowed
 */
function isAllowedFileExtension(filename, allowedExtensions) {
  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Generate SHA256 hash
 */
function sha256(data) {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Wait for specified milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateRandomString,
  isValidEmail,
  validatePasswordStrength,
  sanitizeFilename,
  formatBytes,
  ipInCIDR,
  ipToNumber,
  getPaginationMetadata,
  deepClone,
  retryWithBackoff,
  isAllowedFileExtension,
  sha256,
  delay
};
