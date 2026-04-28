const { createClient } = require('redis');
const config = require('./env');
const { logger } = require('../utils/logger');

const redisClient = createClient({
  url: config.redis.url
});

redisClient.on('error', (err) => logger.error({ err: err.message }, 'Redis Client Error'));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// Connect immediately (or handled in app.js, but safe to call connect)
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.warn('Failed to connect to Redis immediately, will retry');
  }
})();

module.exports = redisClient;
