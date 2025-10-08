#!/bin/bash

# ============================================
# Discord Notion Bot - Start Script
# ============================================

set -e

echo "🚀 Discord Notion Voice Assistant - Starting..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not available"
    echo "Please install Docker Desktop which includes Compose"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create a .env file from .env.example:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then fill in your configuration values."
    exit 1
fi

# Change to project root directory
cd "$(dirname "$0")/.."

echo "📦 Building and starting containers..."
echo ""

# Build and start containers
docker compose -f docker/docker-compose.yml up -d --build

echo ""
echo "⏳ Waiting for application to be healthy..."

# Wait for health check
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker inspect --format='{{.State.Health.Status}}' discord-notion-bot 2>/dev/null | grep -q "healthy"; then
        echo ""
        echo "✅ Application is healthy!"
        break
    fi
    
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "⚠️  Health check timeout. Showing logs:"
    echo ""
    docker compose -f docker/docker-compose.yml logs --tail=50
    exit 1
fi

# Get the port from .env or default
PORT=$(grep "^PORT=" .env | cut -d'=' -f2 || echo "3000")

echo ""
echo "=========================================="
echo "✅ Discord Notion Bot is running!"
echo "=========================================="
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Invite your bot to Discord using your bot invite URL"
echo ""
echo "2. Link Notion:"
echo "   - Use /link-notion command in Discord"
echo "   - Or visit this URL to authorize:"
echo "   http://localhost:${PORT}/oauth/notion/callback"
echo ""
echo "3. Join a voice channel:"
echo "   - Use /join #voice-channel"
echo ""
echo "4. Start speaking commands like:"
echo "   - 'Open page tasks'"
echo "   - 'Add a paragraph with hello world'"
echo "   - 'Create a heading level 1 with introduction'"
echo ""
echo "🔍 View logs:"
echo "   docker compose -f docker/docker-compose.yml logs -f"
echo ""
echo "🛑 Stop the bot:"
echo "   ./scripts/stop.sh (or double-click stop.sh)"
echo ""
echo "=========================================="
