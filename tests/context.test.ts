import { describe, it, expect, beforeEach } from 'vitest';
import { userContextStore } from '../src/core/context/user-context.js';

describe('User Context Store', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    userContextStore.reset(testUserId);
  });

  it('should create default context for new user', () => {
    const context = userContextStore.get(testUserId);
    expect(context.userId).toBe(testUserId);
    expect(context.currentPageId).toBeNull();
    expect(context.targetPageId).toBeNull();
    expect(context.dryRun).toBe(false);
    expect(context.history).toEqual([]);
  });

  it('should update context fields', () => {
    userContextStore.set(testUserId, { dryRun: true });
    const context = userContextStore.get(testUserId);
    expect(context.dryRun).toBe(true);
  });

  it('should track page navigation history', () => {
    userContextStore.setCurrentPage(testUserId, 'page-1');
    expect(userContextStore.get(testUserId).currentPageId).toBe('page-1');

    userContextStore.setCurrentPage(testUserId, 'page-2');
    const context = userContextStore.get(testUserId);
    expect(context.currentPageId).toBe('page-2');
    expect(context.history).toHaveLength(1);
    expect(context.history[0].pageId).toBe('page-1');
  });

  it('should go back to previous page', () => {
    userContextStore.setCurrentPage(testUserId, 'page-1');
    userContextStore.setCurrentPage(testUserId, 'page-2');

    const prevPageId = userContextStore.goBack(testUserId);
    expect(prevPageId).toBe('page-1');
    expect(userContextStore.get(testUserId).currentPageId).toBe('page-1');
  });

  it('should return null when no history', () => {
    const prevPageId = userContextStore.goBack(testUserId);
    expect(prevPageId).toBeNull();
  });

  it('should limit history to 20 items', () => {
    for (let i = 0; i < 25; i++) {
      userContextStore.setCurrentPage(testUserId, `page-${i}`);
    }

    const context = userContextStore.get(testUserId);
    expect(context.history.length).toBeLessThanOrEqual(20);
  });

  it('should track latencies', () => {
    userContextStore.addLatency(testUserId, 'stt', 100);
    userContextStore.addLatency(testUserId, 'stt', 200);
    userContextStore.addLatency(testUserId, 'nlu', 300);

    const latencies = userContextStore.getAverageLatencies(testUserId);
    expect(latencies.stt).toBe(150);
    expect(latencies.nlu).toBe(300);
    expect(latencies.notion).toBe(0);
  });

  it('should limit latency measurements to 50', () => {
    for (let i = 0; i < 60; i++) {
      userContextStore.addLatency(testUserId, 'stt', 100);
    }

    const context = userContextStore.get(testUserId);
    expect(context.latencies.stt.length).toBeLessThanOrEqual(50);
  });

  it('should preserve notionLinked on reset', () => {
    userContextStore.set(testUserId, { notionLinked: true });
    userContextStore.setCurrentPage(testUserId, 'page-1');

    userContextStore.reset(testUserId);

    const context = userContextStore.get(testUserId);
    expect(context.notionLinked).toBe(true);
    expect(context.currentPageId).toBeNull();
    expect(context.history).toEqual([]);
  });
});
