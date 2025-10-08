# 🤖 Discord Notion Voice Assistant

Production-ready Discord voice bot that listens to voice commands, transcribes speech using Whisper, interprets intent via GPT function-calling, and executes actions in Notion (create blocks, pages, search, summarize, etc.).

**100% Docker-based deployment with one-click start/stop scripts. No manual command typing required.**

---

## 📊 Overview

```
┌─────────────┐
│   Discord   │
│   Voice     │
│   Channel   │
└──────┬──────┘
       │ Opus Audio
       ▼
┌──────────────┐
│   Bot Voice  │
│   Receiver   │
│   (PCM)      │
└──────┬───────┘
       │ PCM Chunks (3-6s)
       ▼
┌──────────────┐       ┌────────────┐
│   Whisper    │◄──────┤  OpenAI    │
│   STT        │       │    API     │
└──────┬───────┘       └────────────┘
       │ Transcription
       ▼
┌──────────────┐       ┌────────────┐
│  GPT Tools   │◄──────┤  OpenAI    │
│  NLU         │       │    API     │
└──────┬───────┘       └────────────┘
       │ Intent (JSON)
       ▼
┌──────────────┐       ┌────────────┐
│   Notion     │◄──────┤  Notion    │
│   Actions    │       │    API     │
└──────┬───────┘       └────────────┘
       │ Result
       ▼
┌──────────────┐
│   Discord    │
│   Feedback   │
│   (Text)     │
└──────────────┘
```

---

## 🎯 Features

### Voice Pipeline
- **Voice Recognition**: Bot joins a Discord voice channel and listens to the command author only (filtered by `userId`)
- **Speech-to-Text**: Automatic transcription using OpenAI Whisper
- **Intent Parsing**: GPT-4 function-calling to extract structured commands from natural language
- **Notion Integration**: Execute actions in Notion via official API with OAuth authentication

### Slash Commands
- `/join <channel>` - Join a voice channel and start listening
- `/leave` - Leave the current voice channel
- `/link-notion` - Authenticate with Notion via OAuth (DM link)
- `/status` - Show current status (linked Notion, current page, latencies)
- `/dry-run on|off` - Preview actions before execution
- `/target-page <query>` - Lock a target page for all operations
- `/reset-context` - Reset current page and navigation history

### Notion Actions (Voice Commands)
- **OPEN_PAGE**: Search and open a page by name or ID
  - *"Open page tasks"*
- **CREATE_BLOCK**: Add content blocks (paragraph, headings, lists, to-dos, callouts, code, toggles)
  - *"Add a paragraph with hello world"*
  - *"Create a heading level 1 with Introduction"*
- **APPEND_TODO**: Add a to-do item
  - *"Add a task: call Jean"*
- **CREATE_PAGE**: Create a new sub-page
  - *"Create a new page called Meeting Notes"*
- **SUMMARIZE_PAGE**: Generate an AI summary of the current page content
  - *"Summarize this page"*
- **GO_BACK**: Navigate to the previous page
  - *"Go back"*

### Security & Quality
- **Encrypted Token Storage**: AES-256-GCM encryption for Notion access tokens at rest
- **Rate Limiting**: Per-IP rate limiting on API endpoints
- **Structured Logging**: JSON logs with correlation IDs (pino)
- **Latency Tracking**: Monitor STT, NLU, and Notion API performance
- **Docker-Only Execution**: Application refuses to run outside Docker containers
- **Tests**: Unit and integration tests with Vitest
- **Code Quality**: TypeScript strict mode, ESLint, Prettier, Husky hooks

---

## 🛠️ Prerequisites

### Required Software
- **Docker Desktop** (Windows/macOS) or **Docker Engine** (Linux)
  - Includes Docker Compose
  - Download: https://www.docker.com/products/docker-desktop
  - Minimum version: Docker 20.10+, Compose 2.0+

### Required API Keys & Credentials

1. **Discord Bot**
   - Bot token
   - Client ID
   - OAuth2 permissions configured

2. **OpenAI API**
   - API key with access to Whisper and GPT models
   - Get one at: https://platform.openai.com/api-keys

3. **Notion Integration**
   - OAuth client ID and secret
   - Public integration configured
   - Get one at: https://www.notion.so/my-integrations

---

## 🚀 Getting Started

### 1. Create a Discord Bot

1. Go to https://discord.com/developers/applications
2. Click **New Application**, give it a name
3. Go to **Bot** section:
   - Click **Add Bot**
   - Copy the **Token** (you'll need this for `DISCORD_TOKEN`)
   - Enable these **Privileged Gateway Intents**:
     - ✅ **Server Members Intent** (optional, for user filtering)
     - ✅ **Message Content Intent**
   - **Important**: Under "Bot Permissions", enable:
     - ✅ Read Messages/View Channels
     - ✅ Send Messages
     - ✅ Connect (voice)
     - ✅ Speak (voice)
     - ✅ Use Slash Commands

4. Go to **OAuth2 > General**:
   - Copy the **Client ID** (you'll need this for `DISCORD_CLIENT_ID`)

5. Go to **OAuth2 > URL Generator**:
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions:
     - Read Messages/View Channels
     - Send Messages
     - Connect
     - Speak
     - Use Slash Commands
   - Copy the generated URL and open it in your browser to invite the bot to your server

6. Get your **Guild ID** (server ID):
   - In Discord, enable **Developer Mode** (User Settings > Advanced > Developer Mode)
   - Right-click your server icon → **Copy Server ID**
   - This is optional but recommended for instant command registration

### 2. Create a Notion Integration (OAuth)

1. Go to https://www.notion.so/my-integrations
2. Click **New integration**
3. Configure:
   - **Name**: Discord Voice Assistant
   - **Type**: **Public** (required for OAuth)
   - **Capabilities**: Read content, Update content, Insert content
4. Under **OAuth Domain & URIs**:
   - **Redirect URIs**: Add `http://localhost:3000/oauth/notion/callback` (for local)
   - For production, add your domain: `https://your-domain.com/oauth/notion/callback`
5. Copy:
   - **OAuth client ID** → `NOTION_CLIENT_ID`
   - **OAuth client secret** → `NOTION_CLIENT_SECRET`

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` in a text editor and fill in your values:

   ```env
   # Discord
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here  # Optional but recommended

   # OpenAI
   OPENAI_API_KEY=your_openai_api_key_here

   # Notion
   NOTION_CLIENT_ID=your_notion_client_id_here
   NOTION_CLIENT_SECRET=your_notion_client_secret_here
   NOTION_REDIRECT_URI=http://localhost:3000/oauth/notion/callback

   # App
   APP_BASE_URL=http://localhost:3000
   PORT=3000

   # Security - Generate a 32-byte encryption key
   # Run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ENCRYPTION_KEY=your_generated_encryption_key_here

   # DO NOT CHANGE THIS - Required for Docker execution guard
   RUN_IN_DOCKER=true
   ```

3. **Generate an encryption key**:
   ```bash
   # Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

   # Using OpenSSL
   openssl rand -base64 32

   # Or use an online generator (256-bit)
   ```

### 4. Start the Bot (Zero Commands!)

**Windows:**
- Double-click `scripts\start.bat`

**macOS/Linux:**
- Make the script executable (first time only):
  ```bash
  chmod +x scripts/start.sh
  ```
- Double-click `scripts/start.sh` in your file manager, or run:
  ```bash
  ./scripts/start.sh
  ```

The script will:
- ✅ Check for Docker and Docker Compose
- ✅ Verify your `.env` file exists
- ✅ Build the Docker image
- ✅ Start the container
- ✅ Wait for health checks
- ✅ Display the OAuth URL and next steps

**Expected output:**
```
🚀 Discord Notion Voice Assistant - Starting...

📦 Building and starting containers...
✅ Application is healthy!

==========================================
✅ Discord Notion Bot is running!
==========================================

📋 Next steps:
1. Invite your bot to Discord
2. Link Notion: /link-notion
3. Join voice: /join #voice-channel
4. Start speaking!
==========================================
```

---

## 💬 Usage

### Step 1: Link Your Notion Workspace

In Discord, run:
```
/link-notion
```

The bot will send you a DM with an OAuth link. Click it, select your Notion workspace, and authorize the bot.

### Step 2: Join a Voice Channel

```
/join channel:#your-voice-channel
```

The bot will join the voice channel and **listen only to you** (the command author).

### Step 3: Speak Commands

Natural language examples:

- **"Open page tasks"** → Opens a page named "tasks"
- **"Add a paragraph with hello world"** → Creates a paragraph block
- **"Create a heading level 1 called Introduction"** → Creates an H1 heading
- **"Add a task: call Jean tomorrow"** → Creates a to-do item
- **"Summarize this page"** → Generates an AI summary of the current page
- **"Go back"** → Returns to the previous page

### Step 4: View Results

The bot logs all actions with:
- 🗣️ **Transcription**: What you said
- 🧠 **Intent**: Parsed action and parameters
- ✅ **Result**: Success/failure message

Check logs:
```bash
docker compose -f docker/docker-compose.yml logs -f
```

### Other Commands

- `/status` - See current page, dry-run status, latencies
- `/dry-run on` - Enable preview mode (actions require confirmation)
- `/target-page query:Project Alpha` - Lock a specific page as the target
- `/reset-context` - Clear navigation history
- `/leave` - Leave voice channel

---

## 🛑 Stopping the Bot

**Windows:**
- Double-click `scripts\stop.bat`

**macOS/Linux:**
- Double-click `scripts/stop.sh` or run:
  ```bash
  ./scripts/stop.sh
  ```

---

## 🧪 Running Tests

Tests run inside Docker to ensure environment consistency.

**Windows:**
- Double-click `scripts\test.bat`

**macOS/Linux:**
- Run:
  ```bash
  chmod +x scripts/test.sh  # First time only
  ./scripts/test.sh
  ```

The script will:
- Build a test container
- Run all unit and integration tests
- Display results

**Running tests manually:**
```bash
docker compose -f docker/docker-compose.yml exec app pnpm test
```

---

## 🔧 Troubleshooting

### Bot Doesn't Hear Audio

**Symptoms**: No transcription, bot appears to not receive audio

**Solutions**:
1. **Check Discord Bot Permissions**:
   - Ensure the bot has `Connect` and `Speak` permissions in the voice channel
   - Check that `GuildVoiceStates` intent is enabled in the Discord Developer Portal

2. **Verify Audio Input**:
   - Confirm you can speak in the voice channel normally
   - Check that the bot is not server-deafened

3. **Check Logs**:
   ```bash
   docker compose -f docker/docker-compose.yml logs -f | grep "User started speaking"
   ```

4. **Verify Bot Join**:
   - The bot should appear in the voice channel member list
   - Look for "Joined voice channel" in logs

### No Transcription from Whisper

**Symptoms**: Audio is received but not transcribed

**Solutions**:
1. **Check OpenAI API Key**:
   - Verify `OPENAI_API_KEY` is correct in `.env`
   - Ensure your OpenAI account has credits

2. **Check Audio Format**:
   - Logs should show "Transcribing audio with Whisper"
   - WAV file size should be > 0 bytes

3. **Verify Chunk Size**:
   - Audio chunks must be at least 0.5 seconds
   - Check logs for "Audio chunk too small, skipping"

### GPT Not Returning Tool Calls

**Symptoms**: Transcription works but no intent is parsed

**Solutions**:
1. **Check GPT Model**:
   - Ensure `OPENAI_MODEL_GPT` supports function-calling (gpt-4, gpt-4-turbo, gpt-4o, gpt-3.5-turbo)
   - Verify API key has access to the model

2. **Check Prompt**:
   - Review logs for the transcription text
   - Ensure commands are clear and match expected patterns

3. **Check Logs**:
   ```bash
   docker compose -f docker/docker-compose.yml logs -f | grep "Intent parsed"
   ```

### Notion API 403 Forbidden

**Symptoms**: "Failed to create block: 403"

**Solutions**:
1. **Check OAuth Scopes**:
   - Verify `NOTION_SCOPES=read,update,insert,search` in `.env`
   - Re-authorize using `/link-notion`

2. **Check Workspace Permissions**:
   - Ensure the integration has access to the workspace
   - In Notion, go to Settings & Members > Integrations
   - Verify the integration is listed and enabled

3. **Check Page Permissions**:
   - The bot can only edit pages it has been granted access to
   - Share pages with the integration manually if needed

### Notion API 429 Rate Limited

**Symptoms**: "Failed to create block: 429"

**Solutions**:
1. **Wait**: Notion rate limits are per-integration
   - Default: 3 requests per second
   - Exponential backoff is implemented

2. **Reduce Frequency**: Speak commands slower

3. **Check for Loops**: Ensure commands aren't triggering repeatedly

### Container Health Check Fails

**Symptoms**: `start.sh` reports "Health check timeout"

**Solutions**:
1. **Check Logs**:
   ```bash
   docker compose -f docker/docker-compose.yml logs
   ```

2. **Environment Variables**:
   - Ensure all required variables in `.env` are filled
   - Especially `ENCRYPTION_KEY` (32 bytes base64)

3. **Port Conflicts**:
   - Ensure port 3000 (or your `PORT` value) is not in use
   - Change `PORT` in `.env` if needed

4. **Docker Resources**:
   - Ensure Docker has enough memory (minimum 2GB)
   - Check Docker Desktop resource settings

---

## 🏭 Production Deployment

### Requirements
- Public domain with HTTPS (Let's Encrypt recommended)
- Reverse proxy (nginx, Caddy, or Traefik)
- Persistent storage (optional, for database-backed token storage)

### Configuration Changes

1. **Update `.env` for production**:
   ```env
   APP_BASE_URL=https://your-domain.com
   NOTION_REDIRECT_URI=https://your-domain.com/oauth/notion/callback
   PORT=3000
   LOG_LEVEL=info
   ```

2. **Update Notion Integration**:
   - Add production redirect URI: `https://your-domain.com/oauth/notion/callback`

3. **Set up Reverse Proxy** (Example with Caddy):

   Create `docker/Caddyfile`:
   ```
   your-domain.com {
       reverse_proxy app:3000
   }
   ```

   Add to `docker-compose.yml`:
   ```yaml
   caddy:
     image: caddy:2-alpine
     restart: unless-stopped
     ports:
       - "80:80"
       - "443:443"
     volumes:
       - ./docker/Caddyfile:/etc/caddy/Caddyfile
       - caddy_data:/data
       - caddy_config:/config
     networks:
       - discord-notion-network

   volumes:
     caddy_data:
     caddy_config:
   ```

4. **Secure Environment Variables**:
   - Use Docker secrets or external secret management (AWS Secrets Manager, Vault)
   - Never commit `.env` to version control

5. **Persistent Storage** (Optional):
   - For multi-server deployments, replace in-memory token store with Redis:
     ```yaml
     redis:
       image: redis:7-alpine
       restart: unless-stopped
       volumes:
         - redis_data:/data
       networks:
         - discord-notion-network
     ```

6. **Monitoring**:
   - Set up log aggregation (ELK, Datadog, CloudWatch)
   - Monitor health endpoint: `https://your-domain.com/health`
   - Set up alerts for container restarts

---

## 📚 Scaling to a Public Bot

If you want to host a public bot (multi-server):

### 1. Discord Sharding
For bots in 2500+ guilds, implement sharding:
```typescript
const client = new Client({
  shards: 'auto',
  intents: [...],
});
```

### 2. External Token Storage
Replace in-memory store with Redis or PostgreSQL:

```typescript
// src/core/notion/token-store.ts
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

export async function setToken(userId: string, token: NotionToken) {
  await redis.set(`notion:${userId}`, encrypt(JSON.stringify(token)));
}
```

### 3. Terms of Service & Privacy Policy
- Document data usage (voice is not stored)
- Explain OAuth permissions
- Provide user data deletion endpoint

### 4. Global Command Registration
Remove `GUILD_ID` from `.env` to register commands globally (takes ~1 hour to propagate)

### 5. Rate Limiting Per User
Implement per-user rate limits instead of per-IP:
```typescript
app.use(rateLimit({
  keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
  // ...
}));
```

---

## 🔐 Security Best Practices

1. **Never Commit Secrets**:
   - `.env` is gitignored by default
   - Use environment-specific `.env` files

2. **Encryption Key Management**:
   - Generate unique keys per environment
   - Store in secret management systems (not in code)
   - Rotate keys periodically

3. **HTTPS Only in Production**:
   - Use Let's Encrypt for free certificates
   - Redirect HTTP to HTTPS

4. **Network Security**:
   - Expose only necessary ports (80, 443)
   - Use Docker networks for inter-container communication
   - Configure firewall rules

5. **Update Dependencies**:
   ```bash
   pnpm update --latest
   pnpm audit
   ```

6. **Audit Logs**:
   - Monitor logs for suspicious activity
   - Set up alerts for authentication failures

---

## 📖 Architecture

### Code Organization
```
src/
├── api/               # Express server (OAuth, health)
├── bot/
│   ├── commands/      # Slash command definitions and handlers
│   └── voice/         # Voice receiver, audio chunking, pipeline
├── core/
│   ├── context/       # User context (current page, history, dry-run)
│   ├── nlu/           # GPT function-calling (intent parsing)
│   ├── notion/        # Notion client, OAuth, actions, encryption
│   ├── stt/           # Whisper transcription
│   └── logging.ts     # Structured logging with pino
└── config/
    └── env.ts         # Environment validation (Zod)
```

### Intent Schema
```typescript
{
  action: "OPEN_PAGE" | "CREATE_BLOCK" | "APPEND_TODO" | "GO_BACK" | ...,
  pageQuery?: string,
  block?: {
    type: "paragraph" | "heading_1" | "to_do" | ...,
    text: string,
  },
  options?: {
    language?: string,  // for code blocks
    emoji?: string,     // for callouts
  }
}
```

### Context Management
Each user has a context:
```typescript
{
  currentPageId: string | null,
  targetPageId: string | null,  // locked via /target-page
  dryRun: boolean,
  history: PageHistoryItem[],   // for GO_BACK
  latencies: { stt: [], nlu: [], notion: [] }
}
```

### Encryption
- Algorithm: AES-256-GCM
- Format: `iv:authTag:ciphertext` (hex-encoded)
- Key: 32-byte random key, base64-encoded in `ENCRYPTION_KEY`

---

## 📦 Docker Details

### Multi-Stage Build
1. **Builder**: Installs dependencies, compiles TypeScript
2. **Runner**: Production dependencies only, non-root user, optimized image

### Healthcheck
- Endpoint: `GET /health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Start period: 40 seconds

### Restart Policy
- `unless-stopped`: Automatically restarts unless manually stopped

---

## 🧰 Development

### Local Development (Without Docker)
⚠️ **Not Recommended** - The application enforces Docker execution

To bypass for development:
1. Temporarily set `RUN_IN_DOCKER=true` in local `.env`
2. Remove the guard check in `src/index.ts`
3. Run:
   ```bash
   pnpm install
   pnpm dev
   ```

### Code Quality
```bash
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix auto-fixable issues
pnpm format       # Format with Prettier
pnpm format:check # Check formatting
```

### Git Hooks
Husky is configured to run linting and formatting on pre-commit.

---

## 🔄 Initializing Git Repository

If you want to version control this project, run these commands:

```bash
git init
git branch -m main
git add .
git commit -m "chore: bootstrap Discord Voice → GPT tools → Notion (Docker-only)"
git remote add origin <URL_OF_YOUR_GIT_REPO>
git push -u origin main
```

Replace `<URL_OF_YOUR_GIT_REPO>` with your actual repository URL (GitHub, GitLab, Bitbucket, etc.).

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Discord.js**: Discord API wrapper
- **@discordjs/voice**: Voice support for Discord
- **OpenAI**: Whisper (STT) and GPT (NLU)
- **Notion**: Official JavaScript SDK
- **pino**: Fast JSON logger

---

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review logs: `docker compose -f docker/docker-compose.yml logs -f`
3. Open an issue with:
   - Steps to reproduce
   - Environment details (OS, Docker version)
   - Relevant log excerpts (redact secrets!)

---

**Built with ❤️ using TypeScript, Docker, and modern DevOps practices.**

