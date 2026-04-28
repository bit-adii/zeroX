# Zero-Trust Secure Data Pipeline

A production-grade system for secure file upload, encryption, and sharing with desktop, CLI, and backend components. Implements zero-trust security principles with end-to-end encryption, audit logging, and zero-knowledge architecture.

## 🔐 Security Features

- **AES-256-CBC** file encryption with per-file random IVs
- **RSA-2048** asymmetric key exchange for key distribution
- **JWT** authentication with configurable expiration
- **bcryptjs** password hashing (12 rounds)
- **Rate limiting** on all endpoints (adaptive per endpoint)
- **RBAC** (Role-Based Access Control) - user, admin roles
- **CORS** with origin whitelisting
- **Security headers** (helmet.js, HSTS, CSP)
- **Input validation** with express-validator
- **Audit logging** of all user actions
- **Access logs** for file operations
- **Path traversal protection** in file operations

## 🏗️ Architecture

### Backend (`backend/`)
- **Express.js** REST API with async/await
- **SQLite** database for user/file metadata
- **Bull** job queue for async processing
- **Redis** for queue persistence
- Modular service-oriented architecture

### Desktop App (`desktop-app/`)
- Electron + React + Vite
- Client-side encryption before upload
- Secure key management
- File sharing interface

### CLI Tool (`cli-tool/`)
- Node.js CLI for programmatic access
- File operations via API
- Encryption/decryption utilities

### Shared Module (`shared/`)
- AES encryption utilities
- RSA key generation and operations
- Shared constants and types

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Redis (for job queues)
- Docker & Docker Compose (optional, for containerized setup)

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <repo>
cd zerotrust-system

# Install backend dependencies
cd backend
npm install
cd ..

# Install desktop app dependencies
cd desktop-app
npm install
cd ..

# Install CLI tool dependencies
cd cli-tool
npm install
cd ..
```

### 2. Environment Configuration

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set required values:
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DATABASE_PATH=./data/zerotrust.db
REDIS_URL=redis://localhost:6379
```

### 3. Start Redis

```bash
# Option 1: Local Redis
redis-server

# Option 2: Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Start Backend

```bash
cd backend
npm run dev
```

Backend API available at: `http://localhost:3000/api/v1`

### 5. (Optional) Start Desktop App

```bash
cd desktop-app
npm run dev
```

### 6. (Optional) Use CLI Tool

```bash
cd cli-tool
node index.js --help
```

## 📚 API Documentation

### Authentication

#### Register User
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

#### Login
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "userId": "uuid",
    "accessToken": "jwt_token",
    "refreshToken": "refresh_jwt_token"
  }
}
```

#### Refresh Token
```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_jwt_token"
}
```

### File Upload

#### Upload Encrypted File
```bash
POST /api/v1/upload
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "filename": "document.pdf",
  "encryptedData": "base64_encrypted_file_data",
  "encryptionIv": "base64_iv",
  "mimetype": "application/pdf"
}

Response:
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "filename": "document.pdf",
    "size": 12345,
    "uploadedAt": "2024-04-25T10:30:00Z",
    "encryptionIv": "base64_iv"
  }
}
```

#### Download File
```bash
GET /api/v1/upload/:fileId/download
Authorization: Bearer <accessToken>
```

#### List User's Files
```bash
GET /api/v1/upload?limit=50&offset=0
Authorization: Bearer <accessToken>
```

#### Delete File
```bash
DELETE /api/v1/upload/:fileId
Authorization: Bearer <accessToken>
```

### File Sharing

#### Create Share Link
```bash
POST /api/v1/share/:fileId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "recipientEmail": "recipient@example.com",
  "accessLevel": "view",  // or "download"
  "expiresIn": 86400      // seconds (optional)
}

Response:
{
  "success": true,
  "data": {
    "shareId": "uuid",
    "fileId": "uuid",
    "recipientEmail": "recipient@example.com",
    "accessLevel": "view",
    "expiresAt": "2024-04-26T10:30:00Z"
  }
}
```

#### Get Shared File (public access)
```bash
GET /api/v1/share/:shareId
```

#### Revoke Share
```bash
DELETE /api/v1/share/:shareId
Authorization: Bearer <accessToken>
```

## 🏛️ Database Schema

### Users Table
```sql
- id (UUID, primary key)
- username (TEXT, unique)
- email (TEXT, unique)
- password_hash (TEXT, bcrypt)
- public_key (TEXT, PEM format)
- private_key_encrypted (TEXT, optional)
- role (TEXT, enum: user/admin)
- status (TEXT, enum: active/suspended)
- metadata (JSON)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)
```

### Files Table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- filename (TEXT)
- original_filename (TEXT)
- size (INTEGER, bytes)
- mimetype (TEXT)
- encryption_iv (TEXT, base64)
- metadata (JSON)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)
```

### File_Shares Table
```sql
- id (UUID, primary key)
- file_id (UUID, foreign key)
- owner_id (UUID, foreign key)
- recipient_email (TEXT)
- encrypted_key (TEXT, RSA encrypted AES key)
- expires_at (INTEGER, optional timestamp)
- access_level (TEXT, enum: view/download)
- created_at (INTEGER, timestamp)
- updated_at (INTEGER, timestamp)
```

### Audit_Logs Table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key)
- action (TEXT)
- resource_type (TEXT)
- resource_id (UUID)
- details (JSON)
- ip_address (TEXT)
- status (TEXT)
- created_at (INTEGER, timestamp)
```

### Access_Logs Table
```sql
- id (UUID, primary key)
- file_id (UUID, foreign key)
- user_id (UUID, foreign key)
- action (TEXT, enum: UPLOAD/DOWNLOAD/VIEW/DELETE)
- ip_address (TEXT)
- user_agent (TEXT)
- status (TEXT)
- metadata (JSON)
- created_at (INTEGER, timestamp)
```

## 🔄 Queue System (Bull + Redis)

The system uses job queues for async processing:

### File Processing Queue
- Triggers file analysis after upload
- Extensible for transcoding, virus scanning, etc.
- Automatic retry on failure (3 attempts)
- Dead-letter handling for failed jobs

### Job Processors
- `analyze` - Extract file metadata and validate
- `transcode` - Format conversion (extensible)

## 🧪 Testing

```bash
cd backend
npm test                    # Run all tests
npm run test:coverage       # With coverage report
```

## 📦 Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Production Checklist
- [ ] Generate strong JWT_SECRET and ENCRYPTION_KEY
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS_ORIGINS for frontend domains
- [ ] Enable rate limiting
- [ ] Set up proper logging infrastructure
- [ ] Configure Redis persistence
- [ ] Enable database backups
- [ ] Set up monitoring and alerting
- [ ] Review security headers configuration

## 🛠️ Development

### Project Structure
```
zerotrust-system/
├── backend/
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Database layer
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── utils/       # Helper functions
│   │   └── app.js       # Express app
│   ├── package.json
│   └── .env.example
├── desktop-app/
├── cli-tool/
├── shared/
└── docker-compose.yml
```

### Code Style
- Uses async/await (no callback hell)
- Structured logging with Pino
- Error handling at every level
- Input validation on all endpoints
- DRY principle for shared logic

###Tips for Security Improvements

1. **Rate Limiting**: Configured per endpoint type
2. **Input Validation**: Using express-validator schemas
3. **Encryption**: AES-256 for files, RSA for key exchange
4. **Database**: Foreign key constraints, indexed queries
5. **Audit**: All actions logged with IP, user-agent, timestamps
6. **RBAC**: Role-based access control on sensitive endpoints

## 🤝 Contributing

1. Follow the established code structure
2. Add tests for new features
3. Update documentation
4. Run linter before committing

## 📄 License

MIT

## ⚠️ Security Notices

This is a learning/demonstration project. For production use:
- Conduct security audit
- Enable HTTPS/TLS
- Use environment-based secrets management
- Implement rate limiting on reverse proxy
- Set up DDoS protection
- Regular security updates
- Penetration testing

## 📞 Support

For issues and questions, please open an issue on the repository.
