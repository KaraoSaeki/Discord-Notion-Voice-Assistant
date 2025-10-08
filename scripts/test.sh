#!/bin/bash

# ============================================
# Discord Notion Bot - Test Script
# ============================================

set -e

echo "🧪 Discord Notion Voice Assistant - Running Tests..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Change to project root directory
cd "$(dirname "$0")/.."

# Create a temporary .env for testing if it doesn't exist
if [ ! -f .env ]; then
    echo "⚠️  No .env file found, creating temporary test environment..."
    cat > .env.test << EOF
RUN_IN_DOCKER=true
DISCORD_TOKEN=test-token
DISCORD_CLIENT_ID=test-client-id
OPENAI_API_KEY=test-api-key
NOTION_CLIENT_ID=test-notion-client
NOTION_CLIENT_SECRET=test-notion-secret
NOTION_REDIRECT_URI=http://localhost:3000/oauth/notion/callback
APP_BASE_URL=http://localhost:3000
PORT=3000
ENCRYPTION_KEY=$(openssl rand -base64 32 || echo "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==")
LOG_LEVEL=error
EOF
    ENV_FILE=".env.test"
else
    ENV_FILE=".env"
fi

echo "📦 Building test container..."
echo ""

# Build the test image
docker build -f docker/Dockerfile -t discord-notion-bot:test ..

echo ""
echo "🧪 Running tests in container..."
echo ""

# Run tests in container
docker run --rm \
    --env-file "$ENV_FILE" \
    -e NODE_ENV=test \
    -e RUN_IN_DOCKER=true \
    discord-notion-bot:test \
    sh -c "cd /app && corepack enable && pnpm install --frozen-lockfile && pnpm test"

TEST_EXIT_CODE=$?

# Clean up temporary env file
if [ "$ENV_FILE" = ".env.test" ]; then
    rm -f .env.test
fi

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Tests failed"
    exit $TEST_EXIT_CODE
fi
