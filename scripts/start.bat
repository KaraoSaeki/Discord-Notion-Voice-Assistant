=> ERROR [app runner  7/10] RUN if [ -f pnpm-lock.yaml ]; then       pnpm install --prod --frozen-lockfile;     else       pnpm install --pr  10.3s 
 => [app builder 6/7] COPY . .                                                                                                                  0.0s 
 => [app builder 7/7] RUN pnpm build                                                                                                            6.4s
------
 > [app runner  7/10] RUN if [ -f pnpm-lock.yaml ]; then       pnpm install --prod --frozen-lockfile;     else       pnpm install --prod;     fi:
1.277 Progress: resolved 1, reused 0, downloaded 0, added 0
1.886  WARN  deprecated supertest@6.3.4: Please upgrade to supertest v7.1.3+, see release notes at https://github.com/forwardemail/supertest/releases/tag/v7.1.3 - maintenance is supported by Forward Email @ https://forwardemail.net
2.078  WARN  deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
2.280 Progress: resolved 18, reused 0, downloaded 14, added 0
2.730  WARN  deprecated @discordjs/voice@0.16.1: This version uses deprecated encryption modes. Please use a newer version.
3.285 Progress: resolved 26, reused 0, downloaded 22, added 0
4.285 Progress: resolved 89, reused 0, downloaded 80, added 0
5.289 Progress: resolved 136, reused 0, downloaded 123, added 0
6.293 Progress: resolved 202, reused 0, downloaded 184, added 0
7.295 Progress: resolved 312, reused 0, downloaded 270, added 0
8.300 Progress: resolved 455, reused 0, downloaded 364, added 0
9.101  WARN  10 deprecated subdependencies found: @humanwhocodes/config-array@0.13.0, @humanwhocodes/object-schema@2.0.3, are-we-there-yet@2.0.0, gauge@3.0.2, glob@7.2.3, inflight@1.0.6, node-domexception@1.0.0, npmlog@5.0.1, rimraf@3.0.2, superagent@8.1.2
9.111 Packages: +204
9.111 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
9.300 Progress: resolved 511, reused 0, downloaded 443, added 123
9.381 Progress: resolved 511, reused 0, downloaded 443, added 204, done
9.644  WARN  Failed to create bin at /app/node_modules/.bin/acorn. ENOENT: no such file or directory, open '/app/node_modules/.pnpm/acorn@8.15.0/node_modules/acorn/bin/acorn'
9.754
9.754 > discord-notion-voice-assistant@1.0.0 prepare /app
9.754 > husky install
9.754
9.761 sh: husky: not found
9.839  ELIFECYCLE  Command failed.
------
failed to solve: process "/bin/sh -c if [ -f pnpm-lock.yaml ]; then       pnpm install --prod --frozen-lockfile;     else       pnpm install --prod;     fi" did not complete successfully: exit code: 1

ÔØî Failed to start containers
Appuyez sur une touche pour continuer...@echo off
REM ============================================
REM Discord Notion Bot - Start Script (Windows)
REM ============================================

echo.
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
