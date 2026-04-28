const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation schemas for request parameters
 */

const createUserSchema = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 32 })
    .withMessage('Username must be 3-32 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain alphanumeric characters, underscores, and hyphens'),
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('publicKey')
    .notEmpty()
    .withMessage('Public key is required')
    .matches(/-----BEGIN PUBLIC KEY-----/)
    .withMessage('Invalid RSA public key format')
];

const loginSchema = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const fileUploadSchema = [
  body('filename')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must be 1-255 characters')
    .custom((value) => {
      // Prevent path traversal
      if (value.includes('..') || value.includes('/') || value.includes('\\')) {
        throw new Error('Invalid filename - path traversal detected');
      }
      return true;
    }),
  body('encryptionIv')
    .isBase64()
    .withMessage('Invalid base64 encryption IV'),
  body('fileSize')
    .isInt({ min: 1, max: 104857600 })
    .withMessage('File size must be between 1 byte and 100MB')
];

const fileShareSchema = [
  param('fileId')
    .matches(/^[a-f0-9-]{36}$/)
    .withMessage('Invalid file ID format'),
  body('recipientEmail')
    .isEmail()
    .withMessage('Invalid recipient email')
    .normalizeEmail(),
  body('accessLevel')
    .isIn(['view', 'download'])
    .withMessage('Access level must be view or download'),
  body('expiresIn')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Expiration must be positive integer (seconds)')
];

const paginationSchema = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative')
    .toInt()
];

const rateLimitSchema = [
  body('maxRequests')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max requests must be positive')
    .toInt(),
  body('windowMs')
    .optional()
    .isInt({ min: 1000 })
    .withMessage('Window must be at least 1000ms')
    .toInt()
];

const changePasswordSchema = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character')
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

module.exports = {
  createUserSchema,
  loginSchema,
  fileUploadSchema,
  fileShareSchema,
  paginationSchema,
  rateLimitSchema,
  changePasswordSchema,
  handleValidationErrors
};
