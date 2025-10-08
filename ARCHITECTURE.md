# 🏗️ Architecture Documentation

## Overview

This document provides a deep dive into the technical architecture of the Discord Notion Voice Assistant.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Layer                            │
│  ┌──────────────┐  Voice  ┌──────────────┐  Browser        │
│  │   Discord    │◄────────┤     User     │◄────────────┐   │
│  │   Client     │         └──────────────┘             │   │
│  └──────┬───────┘                                       │   │
└─────────┼─────────────────────────────────────────────┼─────┘
          │                                               │
          │ WebSocket (Opus Audio)                       │ HTTPS
          │                                               │
┌─────────▼───────────────────────────────────────────────▼─────┐
│                     Application Layer                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Docker Container                       │ │
│  │  ┌────────────────┐         ┌────────────────┐          │ │
│  │  │  Discord Bot   │         │  Express API   │          │ │
│  │  │  (Voice RX)    │         │  (OAuth/Health)│          │ │
│  │  └────────┬───────┘         └────────────────┘          │ │
│  │           │                                               │ │
│  │  ┌────────▼───────────────────────────────────┐         │ │
│  │  │           Core Pipeline                      │         │ │
│  │  │  ┌──────┐   ┌──────┐   ┌──────────────┐   │         │ │
│  │  │  │ STT  │-->│ NLU  │-->│ Notion Actions│   │         │ │
│  │  │  │(Whis)│   │(GPT) │   │   (Client)    │   │         │ │
│  │  │  └──────┘   └──────┘   └──────────────┘   │         │ │
│  │  └────────────────────────────────────────────┘         │ │
│  │                                                           │ │
│  │  ┌────────────────┐       ┌────────────────┐           │ │
│  │  │  User Context  │       │  Token Store   │           │ │
│  │  │  (In-Memory)   │       │  (Encrypted)   │           │ │
│  │  └────────────────┘       └────────────────┘           │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────┬───────────────────┘
                         │                  │
                         │ HTTPS            │ HTTPS
                         │                  │
            ┌────────────▼─────┐   ┌───────▼──────────┐
            │   OpenAI API     │   │   Notion API     │
            │  (Whisper + GPT) │   │   (v1 REST)      │
            └──────────────────┘   └──────────────────┘
```

## Data Flow

### Voice Command Pipeline

1. **Audio Capture**
   - Discord voice connection established via `@discordjs/voice`
   - Opus-encoded audio packets received from Discord Gateway
   - Filter: Only process audio from command author (`userId` match)

2. **Audio Processing**
   - Opus decoder converts to PCM (48kHz, stereo, 16-bit)
   - Buffer audio chunks (4 seconds default)
   - Simple VAD: timeout-based silence detection (2s)

3. **Speech-to-Text (STT)**
   - PCM buffer → WAV format conversion
   - Temporary file write to OS tmpdir
   - OpenAI Whisper API call
   - Cleanup: delete temp file
   - **Latency**: ~500ms - 2s depending on audio length

4. **Natural Language Understanding (NLU)**
   - GPT function-calling with strict schema
   - System prompt defines available actions
   - Parse JSON tool call response
   - Validate with Zod schema
   - **Latency**: ~300ms - 1s

5. **Intent Execution**
   - Retrieve user's Notion client (decrypt token)
   - Execute action via Notion API
   - Update user context (current page, history)
   - **Latency**: ~200ms - 800ms

6. **Feedback**
   - Log results with correlation ID
   - (Future: Send formatted message to Discord text channel)

### OAuth Flow

1. User runs `/link-notion` command
2. Bot sends DM with OAuth URL (state = userId)
3. User authorizes in browser
4. Notion redirects to `/oauth/notion/callback?code=...&state=userId`
5. Express server exchanges code for access token
6. Token encrypted (AES-256-GCM) and stored in-memory
7. User context updated: `notionLinked = true`

## Component Details

### Discord Bot (`src/bot/`)

**Responsibilities:**
- Manage WebSocket connection to Discord Gateway
- Register and handle slash commands
- Join/leave voice channels
- Subscribe to voice streams

**Key Technologies:**
- `discord.js@14`: Discord API client
- `@discordjs/voice`: Voice connection handling
- `prism-media`: Opus decoding

**Voice Receiver Flow:**
```typescript
connection.receiver.speaking.on('start', (userId) => {
  if (userId !== authorId) return; // Filter
  
  const opusStream = receiver.subscribe(userId);
  const pcmStream = opusStream.pipe(new prism.opus.Decoder());
  
  pcmStream.on('data', (chunk) => {
    // Buffer and chunk audio
    processAudioChunk(chunk);
  });
});
```

### Core Pipeline (`src/core/`)

#### STT Module (`stt/whisper.ts`)
- **Input**: PCM Buffer (raw audio)
- **Output**: Transcribed text + duration
- **Process**:
  1. Add WAV header to PCM data
  2. Write to temporary file
  3. Call Whisper API with file stream
  4. Clean up temp file
- **Error Handling**: Retry logic, file cleanup on failure

#### NLU Module (`nlu/gpt-tools.ts`)
- **Input**: Transcription text
- **Output**: Structured intent (validated)
- **Process**:
  1. Construct chat completion request
  2. Include system prompt + user transcription
  3. Force function call via `tool_choice`
  4. Parse and validate JSON response
- **Schema**: Strict Zod validation for type safety

#### Notion Module (`notion/`)

**Token Storage** (`token-store.ts`)
- In-memory Map: `userId → encrypted token JSON`
- Encryption: AES-256-GCM with IV and auth tag
- Format: `iv:authTag:ciphertext` (hex)

**Client Factory** (`client.ts`)
- Lazy client creation per user
- Token decryption on-demand
- Notion API version: 2022-06-28

**Actions** (`actions.ts`)
- Implement each intent action
- Handle Notion API errors (403, 429, 500)
- Update user context (page navigation, history)
- Rate limit handling: exponential backoff (future)

### Express API (`src/api/server.ts`)

**Endpoints:**
- `GET /health`: Health check (used by Docker healthcheck)
- `GET /oauth/notion/callback`: OAuth redirect handler

**Security:**
- Rate limiting: 100 requests per 15 minutes per IP
- Input validation on OAuth params
- No CORS (same-origin only)

### User Context (`src/core/context/user-context.ts`)

**Per-User State:**
```typescript
{
  userId: string,
  currentPageId: string | null,      // Last opened page
  targetPageId: string | null,       // Locked via /target-page
  dryRun: boolean,                   // Preview mode
  history: PageHistoryItem[],        // Navigation stack (max 20)
  notionLinked: boolean,
  latencies: {
    stt: number[],                   // Last 50 measurements
    nlu: number[],
    notion: number[]
  }
}
```

**Operations:**
- `get(userId)`: Retrieve or create default context
- `set(userId, partial)`: Update specific fields
- `reset(userId)`: Clear history and pages (preserve notionLinked)
- `setCurrentPage(userId, pageId)`: Update current page, add previous to history
- `goBack(userId)`: Pop from history, set as current

## Security Model

### Encryption at Rest
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Management**: 32-byte key in `ENCRYPTION_KEY` env var
- **IV**: Random 16 bytes per encryption operation
- **Auth Tag**: 16 bytes, verified on decryption

### Runtime Security
- **Docker Enforcement**: Application exits if `RUN_IN_DOCKER !== 'true'`
- **No Audio Storage**: Audio buffers are never written to disk (except temp WAV, immediately deleted)
- **Token Isolation**: Each user's token is encrypted separately
- **Rate Limiting**: Prevent abuse of OAuth endpoints

### Production Recommendations
1. Use external secret manager (AWS Secrets, Vault)
2. Rotate encryption keys periodically
3. Implement database-backed token store for multi-server setups
4. Add request signing for inter-service communication
5. Enable audit logging for sensitive operations

## Scalability Considerations

### Current Architecture (Single Server)
- **Max Users**: ~100 concurrent voice sessions
- **Token Storage**: In-memory (lost on restart)
- **Command Registration**: Per-guild or global

### Scaling to Multi-Server

**1. Shared Token Store**
```typescript
// Redis implementation
import { createClient } from 'redis';

class RedisTokenStore {
  async set(userId: string, token: NotionToken) {
    const encrypted = encrypt(JSON.stringify(token));
    await redis.setex(`notion:${userId}`, 86400, encrypted);
  }
  
  async get(userId: string): Promise<NotionToken | null> {
    const encrypted = await redis.get(`notion:${userId}`);
    if (!encrypted) return null;
    return JSON.parse(decrypt(encrypted));
  }
}
```

**2. Discord Sharding**
```typescript
const client = new Client({
  shards: 'auto',
  intents: [...],
});
```

**3. Load Balancing**
- Use sticky sessions (based on guild ID)
- Each bot instance handles specific guilds
- Share state via Redis or PostgreSQL

**4. Message Queue for Heavy Tasks**
- Offload Whisper/GPT calls to worker processes
- Use RabbitMQ or AWS SQS

## Testing Strategy

### Unit Tests (`tests/*.test.ts`)
- **Intent Schema Validation**: Ensure all action types are accepted
- **User Context**: Navigation, history, latencies
- **Encryption**: Round-trip encrypt/decrypt, tamper detection

### Integration Tests
- **Express API**: Health endpoint, OAuth callback
- **Notion Actions**: Mock Notion client, test action logic

### Manual Testing Checklist
1. ✅ Bot joins voice channel
2. ✅ Audio is received (check logs)
3. ✅ Transcription appears in logs
4. ✅ Intent is parsed correctly
5. ✅ Notion action executes
6. ✅ User context updates

## Performance Metrics

### Latency Targets
- **Audio Chunk → Transcription**: < 2s (95th percentile)
- **Transcription → Intent**: < 1s (95th percentile)
- **Intent → Notion Action**: < 800ms (95th percentile)
- **End-to-End**: < 4s (from speech end to Notion update)

### Monitoring
- Track per-user average latencies
- Log all errors with correlation IDs
- Alert on repeated failures (> 5 in 5 minutes)

## Error Handling

### Transient Errors (Retry)
- Network timeouts
- 429 Rate Limit (with exponential backoff)
- 5xx Server Errors

### Permanent Errors (Fail Fast)
- 401 Unauthorized (re-auth required)
- 403 Forbidden (permissions issue)
- 400 Bad Request (invalid data)

### User Feedback
- Log error with context
- (Future) Send error message to Discord user

## Future Enhancements

### Short-Term
1. **Dry-Run Confirmation**: Send preview to Discord, await user reaction
2. **Block Update/Delete**: Implement missing actions
3. **Feedback Channel**: Send transcription + result to Discord text channel
4. **Undo Stack**: Local memento pattern for reverting changes

### Medium-Term
1. **Multi-Language Support**: Detect language, adjust Whisper/GPT
2. **Context-Aware Commands**: "Add another paragraph" (infer block type)
3. **Page Templates**: "Create a meeting notes page with standard sections"
4. **Database Operations**: Query and filter database entries

### Long-Term
1. **Voice Output**: TTS responses (e.g., "Page opened successfully")
2. **Conversational Mode**: Multi-turn dialogues
3. **Background Agents**: Scheduled summaries, reminders
4. **Mobile App**: Companion app for OAuth and status

## Deployment Patterns

### Local Development
```yaml
# docker-compose.override.yml
services:
  app:
    volumes:
      - ./src:/app/src  # Hot reload
    environment:
      - LOG_LEVEL=debug
```

### CI/CD Pipeline
1. **Build**: `docker build -t bot:${VERSION}`
2. **Test**: `docker run bot:${VERSION} pnpm test`
3. **Push**: `docker tag bot:${VERSION} registry/bot:${VERSION}`
4. **Deploy**: Update production compose file, `docker stack deploy`

### Production Stack
```yaml
version: '3.8'
services:
  bot:
    image: registry/discord-notion-bot:latest
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
    environment:
      - REDIS_URL=redis://redis:6379
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
  
  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
```

---

**Last Updated**: 2024-10-08
