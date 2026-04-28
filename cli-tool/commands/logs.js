const api = require('../utils/api');
const logger = require('../utils/logger');

async function execute(limit) {
  logger.info(`Fetching last ${limit} audit logs...`);

  try {
    // Assuming backend has an endpoint for audit logs
    const response = await api.get(`/audit/logs?limit=${limit}`);
    
    const logs = response.data.data;
    
    if (logs.length === 0) {
      logger.info('No logs found.');
      return;
    }

    logs.forEach(log => {
      logger.info(`[${new Date(log.created_at).toISOString()}] ${log.action} - Resource: ${log.resource_type}:${log.resource_id}`);
    });

  } catch (err) {
    // If route is missing, warn the user
    if (err.response?.status === 404) {
      throw new Error('Audit log endpoint not implemented in backend yet.');
    }
    throw new Error(err.response?.data?.error || err.message);
  }
}

module.exports = { execute };
