@echo off
REM ============================================
REM Discord Notion Bot - Start Script (Windows)
REM ============================================

echo 🚀 Discord Notion Voice Assistant - Starting...
echo.

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not available
    echo Please install Docker Desktop which includes Compose
    pause
    exit /b 1
)

REM Change to project root directory
cd /d "%~dp0\.."

REM Check if .env file exists
if not exist .env (
    echo ❌ .env file not found!
    echo.
    echo Please create a .env file from .env.example:
    echo   copy .env.example .env
    echo.
    echo Then fill in your configuration values.
    pause
    exit /b 1
)

echo 📦 Building and starting containers...
echo.

REM Build and start containers
docker compose -f docker/docker-compose.yml up -d --build

if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to start containers
    pause
    exit /b 1
)

echo.
echo ⏳ Waiting for application to be healthy...

REM Wait for health check (simple approach for Windows)
timeout /t 10 /nobreak >nul

REM Check container status
docker inspect --format="{{.State.Health.Status}}" discord-notion-bot 2>nul | find "healthy" >nul
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Health check pending. Container may still be starting up.
    echo Check logs if you encounter issues.
)

REM Get the port from .env or default
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr "^PORT=" .env 2^>nul') do set PORT=%%a

echo.
echo ==========================================
echo ✅ Discord Notion Bot is running!
echo ==========================================
echo.
echo 📋 Next steps:
echo.
echo 1. Invite your bot to Discord using your bot invite URL
echo.
echo 2. Link Notion:
echo    - Use /link-notion command in Discord
echo    - Or visit this URL to authorize:
echo    http://localhost:%PORT%/oauth/notion/callback
echo.
echo 3. Join a voice channel:
echo    - Use /join #voice-channel
echo.
echo 4. Start speaking commands like:
echo    - 'Open page tasks'
echo    - 'Add a paragraph with hello world'
echo    - 'Create a heading level 1 with introduction'
echo.
echo 🔍 View logs:
echo    docker compose -f docker/docker-compose.yml logs -f
echo.
echo 🛑 Stop the bot:
echo    Double-click scripts\stop.bat
echo.
echo ==========================================
echo.
pause
