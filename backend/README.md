# Zero-Trust Backend API

Production-grade REST API for secure file upload, encryption, and sharing. Built with Express.js, SQLite, and Redis.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Redis (for job queues)
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env with your values
nano .env

# Start Redis (in separate terminal)
redis-server

# Start backend (development)
npm run dev
```

Server starts on `http://localhost:3000`

## 📋 Environment Setup

Generate required keys:
```bash
# JWT Secret (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (AES-256 requires 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔌 API Endpoints

All endpoints return JSON with format:
```json
{
  "success": boolean,
  "data": {...},
  "error": "error message (if failed)"
}
```

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Create new user | None |
| POST | `/auth/login` | User login | None |
| POST | `/auth/refresh` | Refresh access token | None |
| POST | `/auth/logout` | User logout | JWT |
| GET | `/auth/me` | Get current user | JWT |
| POST | `/auth/change-password` | Change password | JWT |

### File Operations

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/upload` | Upload encrypted file | JWT |
| GET | `/upload` | List user's files | JWT |
| GET | `/upload/:fileId` | Get file info | JWT |
| GET | `/upload/:fileId/download` | Download file | JWT |
| DELETE | `/upload/:fileId` | Delete file | JWT |

### File Sharing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/share/:fileId` | Create share link | JWT |
| GET | `/share/:shareId` | Get shared file | Optional |
| DELETE | `/share/:shareId` | Revoke share | JWT |
| GET | `/upload/:fileId/shares` | List file shares | JWT |

## 🔐 Authentication Flows

### Registration & Login
1. User registers with username, email, password
2. Password hashed with bcryptjs (12 rounds)
3. User's RSA key pair stored (public-private keypair uploaded)
4. Return JWT access token + refresh token

### Token Management
- Access token valid for 24 hours (configurable)
- Refresh token valid for 7 days
- Tokens verified on each protected endpoint
- User must be active status

### Role-Based Access Control
- `user` - Default role, can access own files
- `admin` - Can access all files, manage shares

## 📦 Request Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePass123!",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }'
```

### Upload File
```bash
curl -X POST http://localhost:3000/api/v1/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "document.pdf",
    "encryptedData": "base64_encrypted_content",
    "encryptionIv": "base64_iv",
    "mimetype": "application/pdf"
  }'
```

### Share File
```bash
curl -X POST http://localhost:3000/api/v1/share/FILE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "bob@example.com",
    "accessLevel": "view",
    "expiresIn": 86400
  }'
```

## 🪵 Logging

Structured logging with Pino:
- All requests logged with method, path, duration, status
- Errors logged with full stack trace
- Audit actions logged (login, uploads, shares, etc.)
- File access logged for compliance

Log levels:
- `error` - Errors that need attention
- `warn` - Warnings (rate limits, auth failures)
- `info` - Important events
- `debug` - Development info

## 🚨 Rate Limiting

Configured per endpoint type:
- **General API**: 100 requests / 15 min
- **Auth**: 5 attempts / 15 min
- **Upload**: 50 uploads / hour
- **Password Reset**: 3 attempts / hour
- **Share**: 100 shares / hour

## 🗄️ Database

SQLite database with schema:
- `users` - User accounts and keys
- `files` - File metadata (encrypted at rest)
- `file_shares` - Share links with encryption
- `access_logs` - File access tracking
- `audit_logs` - Compliance audit trail

### Migrations
Database tables created automatically on startup via `config/db.js`

## 🔄 Job Queue

Bull + Redis for async processing:
- File analysis after upload
- Encryption/decryption operations
- Future: scanning, transcoding

Jobs auto-retry with exponential backoff (3 attempts)

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # Coverage report
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Audit Logs
Access through database or future admin dashboard

## 🚀 Production Deployment

### Docker
```bash
docker build -t zerotrust-backend .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=... \
  -e ENCRYPTION_KEY=... \
  -e REDIS_URL=... \
  zerotrust-backend
```

### Environment Checklist
- [ ] NODE_ENV=production
- [ ] Strong JWT_SECRET (use crypto.randomBytes)
- [ ] Strong ENCRYPTION_KEY (32 bytes for AES-256)
- [ ] REDIS_URL configured for persistent Redis
- [ ] DATABASE_PATH points to persistent volume
- [ ] LOG_LEVEL=info or higher
- [ ] CORS_ORIGINS configured for frontend
- [ ] ENABLE_RATE_LIMITING=true
- [ ] ENABLE_AUDIT_LOG=true
- [ ] HTTPS/TLS enabled at reverse proxy

### Recommended Reverse Proxy (Nginx)
```nginx
server {
    listen 443 ssl http2;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔍 Troubleshooting

### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### Database Lock Error
```bash
# Remove stale database lock
rm data/zerotrust.db-wal
rm data/zerotrust.db-shm
```

### Token Expired
- Use refresh token endpoint to get new access token
- Or re-authenticate with login

### Rate Limit Hit
- Wait for window to reset (shown in response headers)
- Or increase limits in .env

## 📚 Architecture

### Middleware Stack
1. Security headers (helmet.js)
2. CORS validation
3. Request logging
4. Rate limiting
5. Body parsing
6. Authentication (if protected route)

### Service Layer
- `encryptionService` - Crypto operations
- `storageService` - File I/O
- `auditService` - Compliance logging
- `queueService` - Async job processing

### Models
- `User` - User data and operations
- `File` - File metadata and operations
- `AccessLog` - Access tracking
- `FileShare` - Share link management

## 🔐 Security Considerations

1. **Encryption**: All files encrypted with AES-256-CBC per instance
2. **Keys**: Private keys encrypted in database
3. **Passwords**: Hashed with bcryptjs (12 rounds)
4. **Audit**: All actions logged with IP, user-agent
5. **CORS**: Restricted to configured origins
6. **Rate Limiting**: Prevents brute force and DoS
7. **Input Validation**: All inputs validated and sanitized
8. **Headers**: Security headers set automatically

## 📝 Development Notes

- Use `npm run dev` for hot-reload during development
- Check logs for any warnings or errors
- Run tests before committing
- Follow existing code patterns for new features
- Add audit logging for security-critical actions

## 📄 License

MIT
