# 🚀 Quick Start Guide

This is the **fastest way** to get your Discord Notion Voice Assistant running.

## ⏱️ 5-Minute Setup

### 1. Prerequisites Check
- ✅ Docker Desktop installed and running
- ✅ Discord bot created (get token + client ID)
- ✅ OpenAI API key
- ✅ Notion integration created (OAuth)

### 2. Configure
```bash
# Copy environment template
cp .env.example .env

# Edit .env and fill in:
# - DISCORD_TOKEN
# - DISCORD_CLIENT_ID
# - GUILD_ID (optional but recommended)
# - OPENAI_API_KEY
# - NOTION_CLIENT_ID
# - NOTION_CLIENT_SECRET
# - ENCRYPTION_KEY (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### 3. Start
**Windows**: Double-click `scripts\start.bat`  
**macOS/Linux**: Double-click `scripts/start.sh` (or `./scripts/start.sh`)

### 4. Use
1. In Discord: `/link-notion` → authorize
2. `/join #voice-channel`
3. Speak: *"Open page tasks"*
4. Done! ✅

## 🔧 Common Issues

**"Docker not found"**
→ Install Docker Desktop: https://www.docker.com/products/docker-desktop

**".env file not found"**
→ Run: `cp .env.example .env` and fill in your values

**"Health check timeout"**
→ Check logs: `docker compose -f docker/docker-compose.yml logs`
→ Verify all .env values are correct

**"Bot doesn't hear me"**
→ Enable "Server Members Intent" and "Message Content Intent" in Discord Developer Portal
→ Ensure bot has Connect + Speak permissions

## 📚 Full Documentation
See [README.md](README.md) for complete documentation.

## 🛑 Stop
**Windows**: Double-click `scripts\stop.bat`  
**macOS/Linux**: Double-click `scripts/stop.sh`
