import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../core/logging.js';

dotenv.config();

const envSchema = z.object({
  // Docker guard
  RUN_IN_DOCKER: z.string().refine((val) => val === 'true', {
    message: 'This application MUST run inside Docker. Set RUN_IN_DOCKER=true in the container.',
  }),

  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  GUILD_ID: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL_GPT: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_WHISPER: z.string().default('whisper-1'),

  // Notion OAuth
  NOTION_CLIENT_ID: z.string().min(1, 'NOTION_CLIENT_ID is required'),
  NOTION_CLIENT_SECRET: z.string().min(1, 'NOTION_CLIENT_SECRET is required'),
  NOTION_REDIRECT_URI: z.string().url('NOTION_REDIRECT_URI must be a valid URL'),
  NOTION_SCOPES: z.string().default('read,update,insert,search'),

  // App / Server
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),
  PORT: z.string().default('3000'),

  // Security
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // Logs
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error({ errors: error.errors }, '❌ Environment validation failed');
    console.error('\n❌ CONFIGURATION ERROR:\n');
    error.errors.forEach((err) => {
      console.error(`  • ${err.path.join('.')}: ${err.message}`);
    });
    console.error('\n📋 Please check your .env file against .env.example\n');
  }
  process.exit(1);
}

export { env };
