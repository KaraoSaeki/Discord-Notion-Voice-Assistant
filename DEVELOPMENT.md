# 🛠️ Development Guide

This guide is for developers who want to contribute to or modify the Discord Notion Voice Assistant.

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm (or npm/yarn)
- Docker Desktop
- Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-notion-bot
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Fill in your credentials
   ```

4. **Install Git hooks**
   ```bash
   pnpm prepare
   ```

## 🧪 Development Workflow

### Running Locally (Docker)

**Start the bot:**
```bash
# Windows
scripts\start.bat

# macOS/Linux
./scripts/start.sh
```

**View logs:**
```bash
docker compose -f docker/docker-compose.yml logs -f
```

**Stop the bot:**
```bash
# Windows
scripts\stop.bat

# macOS/Linux
./scripts/stop.sh
```

### Running Tests

**All tests:**
```bash
pnpm test
```

**Watch mode:**
```bash
pnpm test:watch
```

**In Docker:**
```bash
# Windows
scripts\test.bat

# macOS/Linux
./scripts/test.sh
```

### Code Quality

**Lint:**
```bash
pnpm lint        # Check for issues
pnpm lint:fix    # Auto-fix issues
```

**Format:**
```bash
pnpm format       # Format all files
pnpm format:check # Check formatting
```

**Pre-commit hook:**
- Automatically runs lint + format on staged files
- Configured via `lint-staged` in `package.json`

### Building

**Compile TypeScript:**
```bash
pnpm build
```

**Output:** `dist/` directory

## 📂 Project Structure

```
src/
├── api/                    # Express server
│   └── server.ts           # OAuth routes, health check
├── bot/                    # Discord bot
│   ├── commands/
│   │   ├── index.ts        # Command definitions
│   │   └── handlers.ts     # Command logic
│   ├── voice/
│   │   ├── receiver.ts     # Audio capture
│   │   └── intent-executor.ts  # Execute Notion actions
│   └── index.ts            # Bot initialization
├── core/                   # Core business logic
│   ├── context/
│   │   └── user-context.ts # User state management
│   ├── nlu/
│   │   └── gpt-tools.ts    # GPT function-calling
│   ├── notion/
│   │   ├── actions.ts      # Notion API operations
│   │   ├── client.ts       # Notion client factory
│   │   ├── encryption.ts   # AES-256 encryption
│   │   └── token-store.ts  # Token storage
│   ├── stt/
│   │   └── whisper.ts      # Whisper transcription
│   └── logging.ts          # Pino logger setup
├── config/
│   └── env.ts              # Environment validation
└── index.ts                # Application entry point

tests/                      # Test files
├── api.test.ts
├── context.test.ts
├── encryption.test.ts
└── nlu.test.ts

docker/                     # Docker configuration
├── Dockerfile
└── docker-compose.yml

scripts/                    # One-click scripts
├── start.sh / start.bat
├── stop.sh / stop.bat
└── test.sh / test.bat
```

## 🔧 Common Tasks

### Adding a New Slash Command

1. **Define the command** (`src/bot/commands/index.ts`)
   ```typescript
   new SlashCommandBuilder()
     .setName('my-command')
     .setDescription('Description here')
     .addStringOption(...)
   ```

2. **Create the handler** (`src/bot/commands/handlers.ts`)
   ```typescript
   export async function handleMyCommand(
     interaction: ChatInputCommandInteraction
   ): Promise<void> {
     await interaction.deferReply({ ephemeral: true });
     // Your logic here
     await interaction.editReply('Done!');
   }
   ```

3. **Register the handler** (`src/bot/index.ts`)
   ```typescript
   case 'my-command':
     await handleMyCommand(interaction);
     break;
   ```

4. **Test:** Restart the bot, commands auto-register if `GUILD_ID` is set

### Adding a New Notion Action

1. **Add to intent schema** (`src/core/nlu/gpt-tools.ts`)
   ```typescript
   action: z.enum([
     // ... existing actions
     'MY_NEW_ACTION',
   ])
   ```

2. **Update system prompt** (same file)
   ```typescript
   const SYSTEM_PROMPT = `
   ...
   - MY_NEW_ACTION: description of what it does
   `;
   ```

3. **Implement action** (`src/core/notion/actions.ts`)
   ```typescript
   export async function myNewAction(
     notion: Client,
     userId: string,
     params: ...,
     correlationId: string
   ): Promise<NotionActionResult> {
     // Implementation
   }
   ```

4. **Wire up executor** (`src/bot/voice/intent-executor.ts`)
   ```typescript
   case 'MY_NEW_ACTION':
     return myNewAction(notion, userId, intent.params, correlationId);
   ```

5. **Add tests** (`tests/notion.actions.test.ts`)

### Adding Environment Variables

1. **Add to schema** (`src/config/env.ts`)
   ```typescript
   const envSchema = z.object({
     // ... existing
     MY_NEW_VAR: z.string().min(1, 'MY_NEW_VAR is required'),
   });
   ```

2. **Add to `.env.example`** with comments
   ```env
   # My New Variable
   # Description of what it does and how to get it
   MY_NEW_VAR=example_value
   ```

3. **Update README** if user-facing

## 🐛 Debugging

### Enable Debug Logs
```env
LOG_LEVEL=debug
```

### View Specific Logs
```bash
# STT logs
docker compose -f docker/docker-compose.yml logs -f | grep "Transcribing"

# NLU logs
docker compose -f docker/docker-compose.yml logs -f | grep "Intent parsed"

# Notion logs
docker compose -f docker/docker-compose.yml logs -f | grep "Executing intent"
```

### Inspect Container
```bash
docker compose -f docker/docker-compose.yml exec app sh
```

### Check Health
```bash
curl http://localhost:3000/health
```

## 🧪 Testing Strategy

### Unit Tests
- **What**: Test individual functions in isolation
- **Where**: `tests/*.test.ts`
- **Mocking**: Use Vitest mocks for external APIs
- **Example**:
  ```typescript
  it('should encrypt and decrypt correctly', () => {
    const encrypted = encrypt('test');
    expect(decrypt(encrypted)).toBe('test');
  });
  ```

### Integration Tests
- **What**: Test multiple components together
- **Where**: `tests/api.test.ts`
- **Setup**: Spin up test server
- **Example**:
  ```typescript
  it('should respond to health check', async () => {
    const response = await fetch('http://localhost:3001/health');
    expect(response.status).toBe(200);
  });
  ```

### Manual Testing
1. Start the bot
2. Run `/join` in Discord
3. Speak a command
4. Check logs for:
   - 🗣️ Transcription
   - 🧠 Intent
   - ✅ Result

## 📦 Release Process

### Version Bump
1. Update `package.json` version
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore: bump version to x.y.z"`
4. Tag: `git tag -a vx.y.z -m "Release x.y.z"`
5. Push: `git push origin main --tags`

### Docker Image
```bash
docker build -f docker/Dockerfile -t discord-notion-bot:x.y.z .
docker tag discord-notion-bot:x.y.z registry/discord-notion-bot:latest
docker push registry/discord-notion-bot:x.y.z
docker push registry/discord-notion-bot:latest
```

### Deploy
1. Update production `.env` with new image tag
2. Run: `docker compose pull && docker compose up -d`
3. Monitor logs for errors

## 🔍 Troubleshooting

### "Module not found" errors
```bash
# Clean and reinstall
rm -rf node_modules dist pnpm-lock.yaml
pnpm install
pnpm build
```

### TypeScript errors
```bash
# Check TypeScript version
pnpm list typescript

# Rebuild
pnpm build
```

### Docker build fails
```bash
# Clear Docker cache
docker builder prune

# Rebuild without cache
docker compose -f docker/docker-compose.yml build --no-cache
```

### Tests fail in Docker but pass locally
- Ensure `.env` has correct values for test environment
- Check that `RUN_IN_DOCKER=true` is set in test script

## 🎯 Performance Optimization

### Reduce Latency
1. **STT**: Use smaller audio chunks (trade-off: more API calls)
2. **NLU**: Use `gpt-3.5-turbo` instead of `gpt-4` (trade-off: accuracy)
3. **Notion**: Batch operations where possible

### Reduce Memory Usage
1. Limit history size (currently 20 pages)
2. Limit latency tracking (currently 50 measurements)
3. Clear audio buffers immediately after processing

### Scale Horizontally
1. Implement Redis-backed token store
2. Use Discord sharding
3. Deploy multiple instances behind load balancer

## 📚 Resources

- [Discord.js Guide](https://discordjs.guide/)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Notion API Reference](https://developers.notion.com/reference)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Vitest Docs](https://vitest.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Write tests
5. Ensure all tests pass: `pnpm test`
6. Commit: `git commit -m "feat: add my feature"`
7. Push: `git push origin feature/my-feature`
8. Open a Pull Request

### Commit Message Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

## 💡 Tips

- **Use correlation IDs**: Every request has a unique ID for tracing
- **Log liberally**: Use appropriate log levels (debug, info, error)
- **Test with dry-run**: Enable `/dry-run on` to preview actions
- **Monitor latencies**: Use `/status` to check performance
- **Keep tokens secure**: Never log or expose encryption keys

---

**Happy coding! 🚀**
