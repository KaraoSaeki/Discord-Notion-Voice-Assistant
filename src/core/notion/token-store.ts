import { encrypt, decrypt } from './encryption.js';
import { logger } from '../logging.js';

interface NotionToken {
  accessToken: string;
  workspaceId: string;
  botId: string;
  expiresAt?: number;
}

/**
 * In-memory encrypted token store
 * For production with multiple servers, use Redis or a database
 */
class NotionTokenStore {
  private tokens = new Map<string, string>(); // userId -> encrypted token JSON

  set(userId: string, token: NotionToken): void {
    const encrypted = encrypt(JSON.stringify(token));
    this.tokens.set(userId, encrypted);
    logger.info({ userId, workspaceId: token.workspaceId }, 'Notion token stored');
  }

  get(userId: string): NotionToken | null {
    const encrypted = this.tokens.get(userId);
    if (!encrypted) {
      return null;
    }

    try {
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted) as NotionToken;
    } catch (error) {
      logger.error({ userId, error }, 'Failed to decrypt Notion token');
      return null;
    }
  }

  has(userId: string): boolean {
    return this.tokens.has(userId);
  }

  delete(userId: string): void {
    this.tokens.delete(userId);
    logger.info({ userId }, 'Notion token deleted');
  }
}

export const notionTokenStore = new NotionTokenStore();
