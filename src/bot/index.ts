import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../core/logging.js';
import {
  handleJoin,
  handleLeave,
  handleLinkNotion,
  handleStatus,
  handleDryRun,
  handleTargetPage,
  handleResetContext,
} from './commands/handlers.js';

export function createBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, '🤖 Discord bot ready');
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case 'join':
          await handleJoin(interaction);
          break;
        case 'leave':
          await handleLeave(interaction);
          break;
        case 'link-notion':
          await handleLinkNotion(interaction);
          break;
        case 'status':
          await handleStatus(interaction);
          break;
        case 'dry-run':
          await handleDryRun(interaction);
          break;
        case 'target-page':
          await handleTargetPage(interaction);
          break;
        case 'reset-context':
          await handleResetContext(interaction);
          break;
        default:
          await interaction.reply({ content: 'Unknown command', ephemeral: true });
      }
    } catch (error) {
      logger.error({ error, command: interaction.commandName }, 'Command execution failed');
      if (interaction.deferred) {
        await interaction.editReply('❌ An error occurred while executing this command');
      } else {
        await interaction.reply({
          content: '❌ An error occurred while executing this command',
          ephemeral: true,
        });
      }
    }
  });

  client.on(Events.Error, (error) => {
    logger.error({ error }, 'Discord client error');
  });

  return client;
}

export async function startBot(): Promise<Client> {
  const client = createBot();
  await client.login(env.DISCORD_TOKEN);
  return client;
}
