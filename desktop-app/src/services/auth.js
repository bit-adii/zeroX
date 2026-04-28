import api from './api';
import encryptionService from './encryption';

/**
 * Authentication service for user management
 */
class AuthService {
  /**
   * Register new user
   */
  async register(username, email, password, publicKey) {
    try {
      const response = await api.register(username, email, password, publicKey);

      if (response.data.success) {
        const { accessToken, refreshToken, userId } = response.data.data;

        // Store tokens
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('user', JSON.stringify(response.data.data));

        return response.data.data;
      }

      throw new Error(response.data.error || 'Registration failed');
    } catch (error) {
      console.error('Registration error:', error);
      throw error.response?.data?.error || error.message;
    }
  }

  /**
   * Login user
   */
  async login(username, password) {
    try {
      const response = await api.login(username, password);

      if (response.data.success) {
        const { accessToken, refreshToken, userId, user } = response.data.data;

        // Store tokens and user info
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('user', JSON.stringify(user || response.data.data));

        return response.data.data;
      }

      throw new Error(response.data.error || 'Login failed');
    } catch (error) {
      console.error('Login error:', error);
      throw error.response?.data?.error || error.message;
    }
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem('accessToken');
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.logout();
    } catch (error) {
      console.warn('Logout API error:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
    }
  }

  /**
   * Get user profile
   */
  async getProfile() {
    try {
      const response = await api.getProfile();

      if (response.data.success) {
        const user = response.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        return user;
      }

      throw new Error(response.data.error || 'Failed to fetch profile');
    } catch (error) {
      console.error('Profile fetch error:', error);
      throw error.response?.data?.error || error.message;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword, newPassword) {
    try {
      // Validate new password strength
      const validation = encryptionService.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      const response = await api.changePassword(oldPassword, newPassword);

      if (response.data.success) {
        return response.data.message;
      }

      throw new Error(response.data.error || 'Password change failed');
    } catch (error) {
      console.error('Password change error:', error);
      throw error.response?.data?.error || error.message;
    }
  }
}

export default new AuthService();
