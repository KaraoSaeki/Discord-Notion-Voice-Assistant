import { logger } from '../logging.js';

export interface PageHistoryItem {
  pageId: string;
  timestamp: number;
}

export interface UserContext {
  userId: string;
  currentPageId: string | null;
  targetPageId: string | null; // Locked target via /target-page
  dryRun: boolean;
  history: PageHistoryItem[];
  notionLinked: boolean;
  latencies: {
    stt: number[];
    nlu: number[];
    notion: number[];
  };
}

class UserContextStore {
  private contexts = new Map<string, UserContext>();

  get(userId: string): UserContext {
    if (!this.contexts.has(userId)) {
      this.contexts.set(userId, this.createDefault(userId));
    }
    return this.contexts.get(userId)!;
  }

  set(userId: string, context: Partial<UserContext>): void {
    const current = this.get(userId);
    this.contexts.set(userId, { ...current, ...context });
    logger.debug({ userId, context }, 'Context updated');
  }

  reset(userId: string): void {
    const current = this.get(userId);
    this.contexts.set(userId, {
      ...this.createDefault(userId),
      notionLinked: current.notionLinked, // Keep Notion link
    });
    logger.info({ userId }, 'Context reset');
  }

  setCurrentPage(userId: string, pageId: string): void {
    const context = this.get(userId);
    if (context.currentPageId && context.currentPageId !== pageId) {
      context.history.push({
        pageId: context.currentPageId,
        timestamp: Date.now(),
      });
      // Keep last 20 items
      if (context.history.length > 20) {
        context.history.shift();
      }
    }
    context.currentPageId = pageId;
    this.contexts.set(userId, context);
  }

  goBack(userId: string): string | null {
    const context = this.get(userId);
    const prev = context.history.pop();
    if (prev) {
      context.currentPageId = prev.pageId;
      this.contexts.set(userId, context);
      return prev.pageId;
    }
    return null;
  }

  addLatency(userId: string, type: 'stt' | 'nlu' | 'notion', latency: number): void {
    const context = this.get(userId);
    context.latencies[type].push(latency);
    // Keep last 50 measurements
    if (context.latencies[type].length > 50) {
      context.latencies[type].shift();
    }
    this.contexts.set(userId, context);
  }

  getAverageLatencies(userId: string): { stt: number; nlu: number; notion: number } {
    const context = this.get(userId);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      stt: avg(context.latencies.stt),
      nlu: avg(context.latencies.nlu),
      notion: avg(context.latencies.notion),
    };
  }

  private createDefault(userId: string): UserContext {
    return {
      userId,
      currentPageId: null,
      targetPageId: null,
      dryRun: false,
      history: [],
      notionLinked: false,
      latencies: {
        stt: [],
        nlu: [],
        notion: [],
      },
    };
  }
}

export const userContextStore = new UserContextStore();
