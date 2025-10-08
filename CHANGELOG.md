# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-08

### 🎉 Initial Release

#### Added
- **Discord Voice Integration**
  - Voice channel join/leave functionality
  - Audio capture and processing (Opus → PCM)
  - User-specific voice filtering (only listen to command author)
  - VAD (Voice Activity Detection) with chunk buffering

- **Speech-to-Text**
  - OpenAI Whisper integration
  - PCM to WAV conversion
  - Automatic temp file management
  - Latency tracking

- **Natural Language Understanding**
  - GPT-4 function-calling for intent parsing
  - Strict JSON schema validation with Zod
  - Support for 8 action types:
    - OPEN_PAGE
    - CREATE_BLOCK
    - UPDATE_BLOCK (stub)
    - DELETE_BLOCK (stub)
    - GO_BACK
    - CREATE_PAGE
    - APPEND_TODO
    - SUMMARIZE_PAGE

- **Notion Integration**
  - OAuth 2.0 authentication flow
  - AES-256-GCM encrypted token storage
  - Page operations: search, create, navigate
  - Block operations: create (9 types), append
  - Page summarization with GPT
  - Navigation history (20-page stack)

- **Slash Commands**
  - `/join` - Join voice channel
  - `/leave` - Leave voice channel
  - `/link-notion` - OAuth authentication
  - `/status` - Show bot status and latencies
  - `/dry-run` - Toggle preview mode
  - `/target-page` - Lock a target page
  - `/reset-context` - Clear navigation history

- **User Context Management**
  - Per-user state tracking
  - Current/target page management
  - Navigation history with go-back support
  - Dry-run mode
  - Latency metrics (STT, NLU, Notion)

- **Security**
  - Docker-only execution enforcement
  - Encrypted token storage at rest
  - Rate limiting (100 req/15min per IP)
  - No audio persistence (temp files only)
  - Environment variable validation

- **Infrastructure**
  - Multi-stage Docker build
  - Docker Compose configuration
  - Health checks
  - Auto-restart policy
  - Structured JSON logging (pino)
  - Correlation IDs for request tracing

- **Developer Experience**
  - One-click start/stop scripts (Windows + Unix)
  - Automated test execution in Docker
  - TypeScript strict mode
  - ESLint + Prettier + Husky
  - Comprehensive test suite (Vitest)
  - Auto-registration of slash commands

- **Documentation**
  - Comprehensive README with architecture diagrams
  - Quick start guide
  - Detailed architecture documentation
  - Troubleshooting section
  - Production deployment guide
  - Git initialization instructions

#### Block Types Supported
- Paragraph
- Heading (levels 1-3)
- Bulleted list item
- To-do (checkbox)
- Callout (with emoji)
- Code (with language)
- Toggle (collapsible)

#### Technologies
- **Runtime**: Node.js 20, TypeScript 5.3
- **Package Manager**: pnpm
- **Discord**: discord.js@14, @discordjs/voice, prism-media
- **AI**: OpenAI SDK (Whisper + GPT-4)
- **Notion**: @notionhq/client
- **Web**: Express, express-rate-limit
- **Testing**: Vitest, supertest
- **Logging**: pino, pino-pretty
- **Container**: Docker, Docker Compose

### 🔒 Security
- AES-256-GCM encryption for Notion tokens
- 32-byte encryption key requirement
- No audio storage (deleted after processing)
- Rate limiting on API endpoints
- Docker execution enforcement

### 📊 Performance
- Audio chunk size: 4 seconds
- Target latencies:
  - STT: < 2s (95th percentile)
  - NLU: < 1s (95th percentile)
  - Notion: < 800ms (95th percentile)
- History limit: 20 pages
- Latency tracking: Last 50 measurements

### Known Limitations
- Single-server deployment only (in-memory state)
- No persistent token storage (lost on restart)
- No voice output (TTS)
- No multi-turn conversations
- Block update/delete actions incomplete
- No Discord text channel feedback (logs only)

### Future Roadmap
See [ARCHITECTURE.md](ARCHITECTURE.md#future-enhancements) for planned features.

---

## [Unreleased]

### Planned for 1.1.0
- Discord text channel feedback (send results as messages)
- Dry-run confirmation workflow (reactions)
- Complete block update/delete actions
- Undo/redo functionality
- Redis-backed token storage option

### Planned for 1.2.0
- Multi-language support
- Database query operations
- Page template system
- Scheduled tasks (reminders, summaries)

### Planned for 2.0.0
- Voice output (TTS responses)
- Conversational mode (multi-turn)
- Sharding support for public bots
- Mobile companion app
- Background agents

---

[1.0.0]: https://github.com/your-repo/discord-notion-bot/releases/tag/v1.0.0
