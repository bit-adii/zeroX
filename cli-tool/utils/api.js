const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILE = path.join(os.homedir(), '.zerotrust-cli.json');

// Get configuration
function getConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return { baseUrl: 'http://localhost:3000/api/v1', token: null };
}

// Create configured axios instance
const config = getConfig();
const api = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token if available
if (config.token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${config.token}`;
}

// Function to update local config
api.updateConfig = (newConfig) => {
  const updated = { ...config, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
};

module.exports = api;
