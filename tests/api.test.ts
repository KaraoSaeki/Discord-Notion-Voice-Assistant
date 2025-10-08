import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';

describe('Express API', () => {
  let server: Server;
  const port = 3001;

  beforeAll(async () => {
    // Dynamically import to avoid env validation during test setup
    const { app } = await import('../src/api/server.js');
    server = app.listen(port);
  });

  afterAll(() => {
    server?.close();
  });

  it('should respond to health check', async () => {
    const response = await fetch(`http://localhost:${port}/health`);
    const data = (await response.json()) as { status: string; timestamp: string; uptime: number };

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeGreaterThan(0);
  });

  it('should reject OAuth callback without code', async () => {
    const response = await fetch(`http://localhost:${port}/oauth/notion/callback`);
    expect(response.status).toBe(400);
  });

  it('should reject OAuth callback without state', async () => {
    const response = await fetch(`http://localhost:${port}/oauth/notion/callback?code=test-code`);
    expect(response.status).toBe(400);
  });

  it('should handle OAuth error parameter', async () => {
    const response = await fetch(
      `http://localhost:${port}/oauth/notion/callback?error=access_denied`
    );
    expect(response.status).toBe(400);
  });
});
