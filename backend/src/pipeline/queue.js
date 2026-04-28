const { getQueue, addJob, processQueue } = require('../config/queue');

/**
 * Abstract Queue Layer (Kafka-ready)
 * Wraps the Bull queue system so it can be swapped later
 */
class PipelineQueue {
  /**
   * Add job to queue
   */
  async add(topic, data, options = {}) {
    return await addJob(topic, data, options);
  }

  /**
   * Subscribe to queue
   */
  process(topic, concurrency, handler) {
    return processQueue(topic, concurrency, handler);
  }

  /**
   * Get underlying Bull instance if needed
   */
  getRawQueue(topic) {
    return getQueue(topic);
  }
}

module.exports = new PipelineQueue();