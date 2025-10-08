import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice';
import { env } from '../../config/env.js';
import { logger } from '../../core/logging.js';
import { userContextStore } from '../../core/context/user-context.js';
import { notionTokenStore } from '../../core/notion/token-store.js';
import { getNotionClient } from '../../core/notion/client.js';
import { openPage } from '../../core/notion/actions.js';
import { startVoiceReceiver } from '../voice/receiver.js';

/**
 * Handle /join command
 */
export async function handleJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel', true);
  const userId = interaction.user.id;

  if (channel.type !== ChannelType.GuildVoice) {
    await interaction.editReply('❌ Please select a voice channel');
    return;
  }

  if (!interaction.guildId) {
    await interaction.editReply('❌ This command must be used in a guild');
    return;
  }

  try {
    // Check if Notion is linked
    if (!notionTokenStore.has(userId)) {
      await interaction.editReply(
        '❌ Please link your Notion workspace first using `/link-notion`'
      );
      return;
    }

    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild!.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    logger.info({ userId, channelId: channel.id }, 'Joined voice channel');

    // Start listening to this user only
    startVoiceReceiver(connection, userId);

    await interaction.editReply(
      `✅ Joined ${channel.name}\n🎤 Listening to you only\n💬 Say commands like "open page tasks" or "add a paragraph with hello world"`
    );
  } catch (error) {
    logger.error({ error, userId }, 'Failed to join voice channel');
    await interaction.editReply('❌ Failed to join voice channel');
  }
}

/**
 * Handle /leave command
 */
export async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply('❌ This command must be used in a guild');
    return;
  }

  const connection = getVoiceConnection(interaction.guildId);
  if (!connection) {
    await interaction.editReply('❌ Not in a voice channel');
    return;
  }

  connection.destroy();
  logger.info({ guildId: interaction.guildId }, 'Left voice channel');

  await interaction.editReply('✅ Left voice channel');
}

/**
 * Handle /link-notion command
 */
export async function handleLinkNotion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  
  // Notion expects scopes as a single space-separated string
  const scopes = env.NOTION_SCOPES.split(',').map((s: string) => s.trim()).join(' ');

  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', env.NOTION_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.NOTION_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('state', userId);
  authUrl.searchParams.set('scope', scopes);

  await interaction.editReply(
    `🔗 **Link your Notion workspace**\n\nClick here to authorize:\n${authUrl.toString()}\n\n⚠️ Make sure to select the workspace you want to use!`
  );
}

/**
 * Handle /status command
 */
export async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const context = userContextStore.get(userId);
  const notionLinked = notionTokenStore.has(userId);
  const latencies = userContextStore.getAverageLatencies(userId);

  let status = '📊 **Bot Status**\n\n';
  status += `🔗 Notion: ${notionLinked ? '✅ Linked' : '❌ Not linked'}\n`;
  status += `📄 Current Page: ${context.currentPageId || 'None'}\n`;
  status += `🎯 Target Page: ${context.targetPageId || 'None'}\n`;
  status += `🧪 Dry-run: ${context.dryRun ? '✅ Enabled' : '❌ Disabled'}\n`;
  status += `📚 History: ${context.history.length} pages\n\n`;

  if (latencies.stt > 0 || latencies.nlu > 0 || latencies.notion > 0) {
    status += '⏱️ **Average Latencies**\n';
    if (latencies.stt > 0) status += `  • STT (Whisper): ${Math.round(latencies.stt)}ms\n`;
    if (latencies.nlu > 0) status += `  • NLU (GPT): ${Math.round(latencies.nlu)}ms\n`;
    if (latencies.notion > 0) status += `  • Notion API: ${Math.round(latencies.notion)}ms\n`;
  }

  await interaction.editReply(status);
}

/**
 * Handle /dry-run command
 */
export async function handleDryRun(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const mode = interaction.options.getString('mode', true);
  const enabled = mode === 'on';

  userContextStore.set(userId, { dryRun: enabled });

  await interaction.editReply(
    enabled
      ? '🧪 Dry-run mode **enabled**\nActions will be previewed before execution. Reply "validate" or "cancel" to each action.'
      : '✅ Dry-run mode **disabled**\nActions will execute immediately.'
  );
}

/**
 * Handle /target-page command
 */
export async function handleTargetPage(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const query = interaction.options.getString('query', true);
  const notion = getNotionClient(userId);

  if (!notion) {
    await interaction.editReply('❌ Please link your Notion workspace first using `/link-notion`');
    return;
  }

  const result = await openPage(notion, userId, query, interaction.id);

  if (result.success && result.pageId) {
    userContextStore.set(userId, { targetPageId: result.pageId });
    await interaction.editReply(`🎯 Target page locked: ${result.pageId}\n${result.message}`);
  } else {
    await interaction.editReply(`❌ ${result.message}`);
  }
}

/**
 * Handle /reset-context command
 */
export async function handleResetContext(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  userContextStore.reset(userId);

  await interaction.editReply('🔄 Context reset\n✅ Page history cleared');
}
