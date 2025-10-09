import { ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, VoiceConnection } from '@discordjs/voice';
import { env } from '../../config/env.js';
import { logger } from '../../core/logging.js';
import { userContextStore } from '../../core/context/user-context.js';
import { notionTokenStore } from '../../core/notion/token-store.js';
import { getNotionClient } from '../../core/notion/client.js';
import { openPage } from '../../core/notion/actions.js';
import { startVoiceReceiver } from '../voice/receiver.js';
import { pendingAuthStore } from '../../core/notion/pending-auth.js';
import { parseIntent } from '../../core/nlu/gpt-tools.js';
import { executeIntent } from '../voice/intent-executor.js';
import { stopVoiceReceiver } from '../voice/receiver.js';

// Store active voice connections
const activeConnections = new Map<string, VoiceConnection>();

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

    // Store connection
    activeConnections.set(interaction.guildId, connection);
    
    // Log what we stored
    logger.info(
      { 
        guildId: interaction.guildId, 
        channelId: channel.id, 
        state: connection.state.status,
        storedConnections: Array.from(activeConnections.keys())
      },
      'Voice connection established and stored'
    );

    // Start listening to this user only
    startVoiceReceiver(connection, userId);

    await interaction.editReply(
      `✅ **Joined ${channel.name}**\n🎧 Listening to you only\n💬 Say commands like "open page tasks" or "add a paragraph with hello world"`
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

  // Debug: Log what we're looking for
  logger.info(
    { 
      guildId: interaction.guildId,
      storedConnections: Array.from(activeConnections.keys()),
      storeSize: activeConnections.size
    },
    'Looking for voice connection'
  );

  // Try to get connection from our store first
  let connection = activeConnections.get(interaction.guildId);
  
  logger.info(
    { 
      guildId: interaction.guildId,
      foundInStore: !!connection
    },
    'Store lookup result'
  );
  
  // Fallback to getVoiceConnection
  if (!connection) {
    connection = getVoiceConnection(interaction.guildId);
    logger.info(
      { 
        guildId: interaction.guildId,
        foundViaAPI: !!connection
      },
      'API lookup result'
    );
  }
  
  if (!connection) {
    logger.warn(
      { 
        guildId: interaction.guildId,
        storedKeys: Array.from(activeConnections.keys())
      }, 
      'No voice connection found anywhere'
    );
    await interaction.editReply('❌ Not in a voice channel');
    return;
  }

  try {
    const userId = interaction.user.id;
    
    // Stop voice receiver
    stopVoiceReceiver(userId);
    
    // Destroy connection
    connection.destroy();
    
    // Remove from store
    activeConnections.delete(interaction.guildId);
    
    logger.info({ guildId: interaction.guildId, userId }, 'Left voice channel');
    await interaction.editReply('✅ Left voice channel');
  } catch (error) {
    logger.error({ error, guildId: interaction.guildId }, 'Failed to leave voice channel');
    await interaction.editReply('❌ Failed to leave voice channel');
  }
}

/**
 * Handle /link-notion command
 */
export async function handleLinkNotion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  
  // Create a pending authorization entry
  const authCode = pendingAuthStore.create(userId);

  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', env.NOTION_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', env.NOTION_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('state', authCode);

  await interaction.editReply(
    `🔗 **Link your Notion workspace**\n\nClick here to authorize:\n${authUrl.toString()}\n\n⚠️ Make sure to select the workspace you want to use!\n\n⏱️ This link expires in 10 minutes.`
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

/**
 * Handle /execute command
 */
export async function handleExecute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const commandText = interaction.options.getString('command', true);

  // Check if Notion is linked
  const notion = getNotionClient(userId);
  if (!notion) {
    await interaction.editReply('❌ Please link your Notion workspace first using `/link-notion`');
    return;
  }

  try {
    await interaction.editReply(`🔄 Processing: "${commandText}"...`);

    // Parse the text command into an intent
    const { intent } = await parseIntent(commandText, interaction.id);
    logger.info({ userId, commandText, intent }, '📝 Text command parsed');

    // Execute the intent
    const result = await executeIntent(notion, userId, intent, interaction.id);

    // Send result
    if (result.success) {
      await interaction.editReply(`✅ **Success!**\n${result.message}`);
    } else {
      await interaction.editReply(`❌ **Failed**\n${result.message}`);
    }
  } catch (error) {
    logger.error({ error, userId, commandText }, 'Failed to execute text command');
    await interaction.editReply('❌ An error occurred while processing your command');
  }
}
