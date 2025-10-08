@echo off
REM ============================================
REM Discord Notion Bot - Test Script (Windows)
REM ============================================

echo.
echo 🧪 Discord Notion Voice Assistant - Running Tests...
echo.

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not in PATH
    pause
    exit /b 1
)

REM Change to project root directory
cd /d "%~dp0\.."

REM Create a temporary .env for testing if it doesn't exist
if not exist .env (
    echo ⚠️  No .env file found, creating temporary test environment...
    (
        echo RUN_IN_DOCKER=true
        echo DISCORD_TOKEN=test-token
        echo DISCORD_CLIENT_ID=test-client-id
        echo OPENAI_API_KEY=test-api-key
        echo NOTION_CLIENT_ID=test-notion-client
        echo NOTION_CLIENT_SECRET=test-notion-secret
        echo NOTION_REDIRECT_URI=http://localhost:3000/oauth/notion/callback
        echo APP_BASE_URL=http://localhost:3000
        echo PORT=3000
        echo ENCRYPTION_KEY=dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw==
        echo LOG_LEVEL=error
    ) > .env.test
    set ENV_FILE=.env.test
) else (
    set ENV_FILE=.env
)

echo 📦 Building test container...
echo.

REM Build the test image
docker build -f docker/Dockerfile -t discord-notion-bot:test .

if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to build test container
    if exist .env.test del .env.test
    pause
    exit /b 1
)

echo.
echo 🧪 Running tests in container...
echo.

REM Run tests in container
docker run --rm --env-file %ENV_FILE% -e NODE_ENV=test -e RUN_IN_DOCKER=true discord-notion-bot:test sh -c "cd /app && corepack enable && pnpm install --frozen-lockfile && pnpm test"

set TEST_EXIT_CODE=%errorlevel%

REM Clean up temporary env file
if exist .env.test del .env.test

echo.
if %TEST_EXIT_CODE% equ 0 (
    echo ✅ All tests passed!
) else (
    echo ❌ Tests failed
)

pause
exit /b %TEST_EXIT_CODE%
