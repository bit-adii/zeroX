import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle responses and refresh token on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If token expired, try to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken } = response.data.data;
            localStorage.setItem('accessToken', accessToken);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Clear tokens and logout
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  register(username, email, password, publicKey) {
    return this.client.post('/auth/register', {
      username,
      email,
      password,
      publicKey,
    });
  }

  login(username, password) {
    return this.client.post('/auth/login', {
      username,
      password,
    });
  }

  refreshToken(refreshToken) {
    return this.client.post('/auth/refresh', { refreshToken });
  }

  getProfile() {
    return this.client.get('/auth/me');
  }

  changePassword(oldPassword, newPassword) {
    return this.client.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
  }

  logout() {
    return this.client.post('/auth/logout');
  }

  // File upload/download endpoints
  uploadFile(filename, encryptedData, encryptionIv, mimetype, fileSize) {
    return this.client.post('/upload', {
      filename,
      encryptedData,
      encryptionIv,
      mimetype,
      fileSize: parseInt(fileSize, 10),
    });
  }

  downloadFile(fileId) {
    return this.client.get(`/upload/${fileId}/download`);
  }

  getFileInfo(fileId) {
    return this.client.get(`/upload/${fileId}`);
  }

  deleteFile(fileId) {
    return this.client.delete(`/upload/${fileId}`);
  }

  listFiles(limit = 50, offset = 0) {
    return this.client.get('/upload', {
      params: { limit, offset },
    });
  }

  // Share endpoints
  shareFile(fileId, recipientEmail, accessLevel = 'view', expiresIn = null) {
    return this.client.post(`/share/${fileId}`, {
      recipientEmail,
      accessLevel,
      expiresIn,
    });
  }

  getSharedFile(shareId) {
    return this.client.get(`/share/${shareId}`);
  }

  revokeShare(shareId) {
    return this.client.delete(`/share/${shareId}`);
  }

  listShares(fileId) {
    return this.client.get(`/upload/${fileId}/shares`);
  }
}

export default new ApiClient();
