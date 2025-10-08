import { env } from './config/env.js';
import { logger } from './core/logging.js';
import { startServer } from './api/server.js';
import { startBot } from './bot/index.js';
import { registerCommands } from './bot/commands/index.js';

/**
 * Bootstrap the application
 */
async function bootstrap() {
  logger.info('🚀 Starting Discord Notion Voice Assistant...');

  // Validate Docker environment
  if (env.RUN_IN_DOCKER !== 'true') {
    logger.fatal('❌ This application MUST run inside Docker. Set RUN_IN_DOCKER=true.');
    console.error('\n❌ DOCKER REQUIRED\n');
    console.error('This application is designed to run exclusively in Docker.');
    console.error('Please use the provided start scripts:\n');
    console.error('  • Windows: double-click scripts\\start.bat');
    console.error('  • macOS/Linux: double-click scripts/start.sh\n');
    process.exit(1);
  }

  try {
    // Auto-register slash commands if GUILD_ID is present
    if (env.GUILD_ID) {
      logger.info({ guildId: env.GUILD_ID }, 'Auto-registering guild commands...');
      await registerCommands(env.GUILD_ID);
    } else {
      logger.info('No GUILD_ID set, skipping command registration');
      logger.info('Commands will need to be registered manually or set GUILD_ID in .env');
    }

    // Start Express server (OAuth + health)
    await startServer();

    // Start Discord bot
    await startBot();

    logger.info('✅ All systems operational');
  } catch (error) {
    logger.fatal({ error }, '❌ Failed to start application');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start
void bootstrap();
