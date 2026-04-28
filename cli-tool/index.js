#!/usr/bin/env node
const { program } = require('commander');
const uploadCmd = require('./commands/upload');
const shareCmd = require('./commands/share');
const logsCmd = require('./commands/logs');
const logger = require('./utils/logger');

program
  .name('zerotrust')
  .description('CLI to interact with Zero-Trust Secure Data Pipeline')
  .version('1.0.0');

program
  .command('upload')
  .description('Upload and securely encrypt a file')
  .argument('<filepath>', 'Path to the file to upload')
  .action(async (filepath) => {
    try {
      await uploadCmd.execute(filepath);
    } catch (error) {
      logger.error(`Upload failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('share')
  .description('Securely share a file with a user')
  .argument('<fileId>', 'ID of the file to share')
  .argument('<email>', 'Recipient email address')
  .option('-a, --access <level>', 'Access level (view/download)', 'view')
  .action(async (fileId, email, options) => {
    try {
      await shareCmd.execute(fileId, email, options.access);
    } catch (error) {
      logger.error(`Share failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('Fetch audit logs')
  .option('-l, --limit <number>', 'Number of logs to fetch', 50)
  .action(async (options) => {
    try {
      await logsCmd.execute(options.limit);
    } catch (error) {
      logger.error(`Log fetch failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
