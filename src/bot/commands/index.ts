import { SlashCommandBuilder, REST, Routes } from 'discord.js';
import { env } from '../../config/env.js';
import { logger } from '../../core/logging.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join a voice channel and start listening')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The voice channel to join')
        .setRequired(true)
        .addChannelTypes(2) // GuildVoice
    ),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the current voice channel'),

  new SlashCommandBuilder()
    .setName('link-notion')
    .setDescription('Link your Notion workspace via OAuth'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show current bot status and statistics'),

  new SlashCommandBuilder()
    .setName('dry-run')
    .setDescription('Enable or disable dry-run mode (preview actions before executing)')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Enable or disable dry-run')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })
    ),

  new SlashCommandBuilder()
    .setName('target-page')
    .setDescription('Set a target page to work on')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Page name or ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('reset-context')
    .setDescription('Reset current page and history'),

  new SlashCommandBuilder()
    .setName('execute')
    .setDescription('Execute a text command on Notion')
    .addStringOption((option) =>
      option
        .setName('command')
        .setDescription('The command to execute (e.g., "open page tasks", "add paragraph with hello")')
        .setRequired(true)
    ),
].map((command) => command.toJSON());

/**
 * Register slash commands
 */
export async function registerCommands(guildId?: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  try {
    logger.info({ guildId: guildId || 'global' }, 'Registering slash commands...');

    if (guildId) {
      // Guild-specific (instant)
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
        body: commands,
      });
      logger.info({ guildId }, '✅ Guild commands registered');
    } else {
      // Global (takes ~1 hour to propagate)
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: commands,
      });
      logger.info('✅ Global commands registered (may take up to 1 hour to appear)');
    }
  } catch (error) {
    logger.error({ error }, '❌ Failed to register commands');
    throw error;
  }
}
