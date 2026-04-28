const queue = require('./queue');
const { logger } = require('../utils/logger');

/**
 * Produce a job to the pipeline
 * @param {string} topic - The queue topic
 * @param {Object} data - Job payload
 * @param {Object} options - Job options (priority, delay, etc.)
 */
async function produce(topic, data, options = {}) {
  try {
    logger.info({ topic, dataSize: JSON.stringify(data).length }, '📤 Producing job...');
    const job = await queue.add(topic, data, options);
    return job;
  } catch (error) {
    logger.error({ error: error.message, topic }, 'Failed to produce job');
    throw error;
  }
}

module.exports = { produce };