import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import encryptionService from '../services/encryption';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        const { valid, errors } = encryptionService.validatePasswordStrength(password);
        if (!valid) { setError(errors.join('. ')); return; }
        let publicKey = 'placeholder-key';
        if (window.electronAPI && window.electronAPI.generateKeyPair) {
          const keyPair = await window.electronAPI.generateKeyPair();
          publicKey = keyPair.publicKey;
        }
        await register(username, email, password, publicKey);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="logo-icon">ZT</div>
          <span>Zero-Trust Secure Share</span>
        </div>
        <p className="auth-subtitle">Enterprise-grade encrypted file platform</p>

        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder={isLogin ? 'Enter your password' : 'Min 8 chars, uppercase, number, symbol'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit">{isLogin ? 'Sign In Securely' : 'Create Account'}</button>
        </form>

        <button className="link-button" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign In'}
        </button>
      </div>
    </div>
  );
}
