const api = require('../utils/api');
const logger = require('../utils/logger');

async function execute(fileId, email, accessLevel) {
  logger.info(`Generating secure share link for ${logger.highlight(email)}...`);

  try {
    const response = await api.post(`/share/${fileId}`, {
      recipientEmail: email,
      accessLevel
    });

    const { shareId } = response.data.data;
    logger.success('File shared successfully!');
    logger.info(`Share ID: ${logger.highlight(shareId)}`);
    logger.info(`Access Level: ${accessLevel}`);

  } catch (err) {
    throw new Error(err.response?.data?.error || err.message);
  }
}

module.exports = { execute };
