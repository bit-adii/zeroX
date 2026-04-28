const queue = require('./queue');
const { processJob } = require('./processor');
const { logger } = require('../utils/logger');

/**
 * Start queue consumer
 * @param {string} topic - The queue topic to consume
 * @param {number} concurrency - Number of concurrent workers
 */
function startConsumer(topic = 'file-processing', concurrency = 3) {
  logger.info({ topic, concurrency }, 'Starting pipeline consumer...');
  
  queue.process(topic, concurrency, async (jobData, updateProgress, job) => {
    try {
      logger.info({ jobId: job.id, topic }, '📥 Consumer picked up job');
      
      const result = await processJob(jobData, updateProgress);
      
      logger.info({ jobId: job.id, topic }, '✅ Job completed successfully');
      return result;
    } catch (error) {
      logger.error({ error: error.message, jobId: job.id, topic }, '❌ Job failed');
      throw error; // Let Bull handle retries/DLQ
    }
  });
}

module.exports = { startConsumer };
