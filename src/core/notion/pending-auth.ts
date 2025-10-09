import { randomBytes } from 'crypto';

/**
 * Temporary store for pending OAuth authorizations
 * Maps auth code -> userId
 */
class PendingAuthStore {
  private pending = new Map<string, { userId: string; expiresAt: number }>();

  /**
   * Generate a unique auth code for a user
   */
  create(userId: string): string {
    // Clean up expired entries
    this.cleanup();

    // Generate random code
    const code = randomBytes(16).toString('hex');

    // Store with 10-minute expiration
    this.pending.set(code, {
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return code;
  }

  /**
   * Get and remove userId for an auth code
   */
  consume(code: string): string | null {
    const entry = this.pending.get(code);
    
    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.pending.delete(code);
      return null;
    }

    // Consume (one-time use)
    this.pending.delete(code);
    return entry.userId;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [code, entry] of this.pending.entries()) {
      if (now > entry.expiresAt) {
        this.pending.delete(code);
      }
    }
  }
}

export const pendingAuthStore = new PendingAuthStore();
