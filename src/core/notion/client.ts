import { Client } from '@notionhq/client';
import { notionTokenStore } from './token-store.js';
import { logger } from '../logging.js';

/**
 * Get a Notion client for a specific user
 */
export function getNotionClient(userId: string): Client | null {
  const token = notionTokenStore.get(userId);
  if (!token) {
    logger.warn({ userId }, 'No Notion token found for user');
    return null;
  }

  return new Client({
    auth: token.accessToken,
    // Add rate limit handling
    notionVersion: '2022-06-28',
  });
}
