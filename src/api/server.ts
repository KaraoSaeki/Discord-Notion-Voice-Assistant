import express from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { logger } from '../core/logging.js';
import { notionTokenStore } from '../core/notion/token-store.js';
import { userContextStore } from '../core/context/user-context.js';

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP',
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * OAuth callback endpoint for Notion
 */
app.get('/oauth/notion/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error({ error }, 'Notion OAuth error');
    return res.status(400).send(`OAuth error: ${error}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  if (!state || typeof state !== 'string') {
    return res.status(400).send('Missing state parameter');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.NOTION_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, errorText }, 'Token exchange failed');
      return res.status(500).send('Failed to exchange authorization code');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      workspace_id: string;
      bot_id: string;
    };

    // Store token (state contains userId)
    const userId = state;
    notionTokenStore.set(userId, {
      accessToken: tokenData.access_token,
      workspaceId: tokenData.workspace_id,
      botId: tokenData.bot_id,
    });

    // Update user context
    userContextStore.set(userId, { notionLinked: true });

    logger.info({ userId, workspaceId: tokenData.workspace_id }, 'Notion linked successfully');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notion Linked</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            h1 { color: #2ecc71; }
            p { color: #555; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Notion Linked Successfully!</h1>
            <p>You can now close this window and return to Discord.</p>
            <p>Your workspace is now connected to the bot.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error({ error }, 'OAuth callback error');
    res.status(500).send('Internal server error during OAuth');
  }
});

/**
 * Start Express server
 */
export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    const port = parseInt(env.PORT, 10);
    app.listen(port, '0.0.0.0', () => {
      logger.info({ port }, '🌐 Express server started');
      resolve();
    });
  });
}

export { app };
