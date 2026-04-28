const Queue = require('bull');
const { logger } = require('../utils/logger');
const config = require('./env');

const queues = {};

/**
 * Get or create a queue with standard configuration
 * @param {string} queueName - Name of the queue
 * @param {Object} options - Bull queue options
 * @returns {Queue} Bull queue instance
 */
function getQueue(queueName, options = {}) {
  if (queues[queueName]) {
    return queues[queueName];
  }

  const queue = new Queue(queueName, config.redis.url, {
    defaultJob: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false
    },
    settings: {
      lockDuration: 30000,
      lockRenewTime: 15000,
      maxStalledCount: 2,
      maxStalledInterval: 5000,
      guardInterval: 5000
    },
    ...options
  });

  // Global error handlers
  queue.on('error', (error) => {
    logger.error({
      error: error.message,
      queueName
    }, 'Queue error');
  });

  queue.on('failed', (job, error) => {
    logger.error({
      jobId: job.id,
      queueName,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts
    }, 'Job failed');
  });

  queue.on('completed', (job) => {
    logger.debug({
      jobId: job.id,
      queueName,
      progress: job.progress()
    }, 'Job completed');
  });

  queues[queueName] = queue;
  logger.info({ queueName }, 'Queue initialized');
  return queue;
}

/**
 * Add job to queue
 * @param {string} queueName - Queue name
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<Job>} Created job
 */
async function addJob(queueName, data, options = {}) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.add(data, {
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 2000
      },
      priority: options.priority,
      delay: options.delay,
      timeout: options.timeout || 300000, // 5 minutes default
      ...options
    });

    logger.info({
      jobId: job.id,
      queueName,
      data: JSON.stringify(data).substring(0, 100)
    }, 'Job added to queue');

    return job;
  } catch (error) {
    logger.error({
      error: error.message,
      queueName
    }, 'Failed to add job to queue');
    throw error;
  }
}

/**
 * Process jobs in a queue
 * @param {string} queueName - Queue name
 * @param {number} concurrency - Number of concurrent workers
 * @param {Function} processor - Job processing function
 */
function processQueue(queueName, concurrency, processor) {
  try {
    const queue = getQueue(queueName);

    queue.process(concurrency, async (job) => {
      try {
        logger.debug({
          jobId: job.id,
          queueName,
          data: JSON.stringify(job.data).substring(0, 100)
        }, 'Processing job');

        // Call processor with progress callback
        const result = await processor(job.data, (progress) => {
          job.progress(progress);
        }, job);

        logger.info({
          jobId: job.id,
          queueName
        }, 'Job processed successfully');

        return result;
      } catch (error) {
        logger.error({
          jobId: job.id,
          queueName,
          error: error.message
        }, 'Job processing failed');
        throw error;
      }
    });

    logger.info({
      queueName,
      concurrency
    }, 'Queue processor started');
  } catch (error) {
    logger.error({
      error: error.message,
      queueName
    }, 'Failed to set up queue processor');
    throw error;
  }
}

/**
 * Get job status and progress
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job details
 */
async function getJobStatus(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const state = await job.getState();
    const progress = job._progress;

    return {
      jobId: job.id,
      state,
      progress,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason
    };
  } catch (error) {
    logger.error({
      error: error.message,
      queueName,
      jobId
    }, 'Failed to get job status');
    throw error;
  }
}

/**
 * Remove job from queue
 * @param {string} queueName - Queue name
 * @param {string} jobId - Job ID
 * @returns {Promise<void>}
 */
async function removeJob(queueName, jobId) {
  try {
    const queue = getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.info({
        jobId,
        queueName
      }, 'Job removed from queue');
    }
  } catch (error) {
    logger.error({
      error: error.message,
      queueName,
      jobId
    }, 'Failed to remove job');
    throw error;
  }
}

/**
 * Clear queue of all jobs
 * @param {string} queueName - Queue name
 * @returns {Promise<void>}
 */
async function clearQueue(queueName) {
  try {
    const queue = getQueue(queueName);
    // Get counts before clearing
    const counts = await queue.getJobCounts();
    
    await queue.empty();
    
    logger.warn({
      queueName,
      jobsCounts: counts
    }, 'Queue cleared');
  } catch (error) {
    logger.error({
      error: error.message,
      queueName
    }, 'Failed to clear queue');
    throw error;
  }
}

/**
 * Get queue statistics
 * @param {string} queueName - Queue name
 * @returns {Promise<Object>} Queue stats
 */
async function getQueueStats(queueName) {
  try {
    const queue = getQueue(queueName);
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    return {
      queueName,
      isPaused,
      ...counts
    };
  } catch (error) {
    logger.error({
      error: error.message,
      queueName
    }, 'Failed to get queue stats');
    throw error;
  }
}

/**
 * Close all queues gracefully
 * @returns {Promise<void>}
 */
async function closeAllQueues() {
  try {
    const queueNames = Object.keys(queues);
    
    await Promise.all(
      queueNames.map(name => queues[name].close())
    );

    Object.keys(queues).forEach(key => {
      delete queues[key];
    });

    logger.info({ closedQueues: queueNames }, 'All queues closed');
  } catch (error) {
    logger.error({
      error: error.message
    }, 'Failed to close queues');
    throw error;
  }
}

module.exports = {
  getQueue,
  addJob,
  processQueue,
  getJobStatus,
  removeJob,
  clearQueue,
  getQueueStats,
  closeAllQueues
};
