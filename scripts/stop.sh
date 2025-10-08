#!/bin/bash

# ============================================
# Discord Notion Bot - Stop Script
# ============================================

set -e

echo "🛑 Discord Notion Voice Assistant - Stopping..."
echo ""

# Change to project root directory
cd "$(dirname "$0")/.."

# Stop containers
docker compose -f docker/docker-compose.yml down

echo ""
echo "✅ Bot stopped successfully"
echo ""
echo "To start again, run:"
echo "  ./scripts/start.sh (or double-click start.sh)"
