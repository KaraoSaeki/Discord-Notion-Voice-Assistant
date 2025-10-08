import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentSchema } from '../src/core/nlu/gpt-tools.js';

describe('NLU Intent Schema', () => {
  it('should validate a valid OPEN_PAGE intent', () => {
    const intent = {
      action: 'OPEN_PAGE',
      pageQuery: 'My Tasks',
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should validate a valid CREATE_BLOCK intent', () => {
    const intent = {
      action: 'CREATE_BLOCK',
      block: {
        type: 'paragraph',
        text: 'Hello world',
      },
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should validate a valid APPEND_TODO intent', () => {
    const intent = {
      action: 'APPEND_TODO',
      block: {
        type: 'to_do',
        text: 'Call John',
      },
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const intent = {
      action: 'INVALID_ACTION',
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should reject invalid block type', () => {
    const intent = {
      action: 'CREATE_BLOCK',
      block: {
        type: 'invalid_type',
        text: 'Test',
      },
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it('should accept GO_BACK without additional fields', () => {
    const intent = {
      action: 'GO_BACK',
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should accept SUMMARIZE_PAGE without additional fields', () => {
    const intent = {
      action: 'SUMMARIZE_PAGE',
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should accept options with language for code blocks', () => {
    const intent = {
      action: 'CREATE_BLOCK',
      block: {
        type: 'code',
        text: 'console.log("test")',
      },
      options: {
        language: 'javascript',
      },
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it('should accept options with emoji for callout blocks', () => {
    const intent = {
      action: 'CREATE_BLOCK',
      block: {
        type: 'callout',
        text: 'Important note',
      },
      options: {
        emoji: '⚠️',
      },
    };

    const result = IntentSchema.safeParse(intent);
    expect(result.success).toBe(true);
  });
});
