@echo off
REM ============================================
REM Discord Notion Bot - Stop Script (Windows)
REM ============================================

echo.
echo 🛑 Discord Notion Voice Assistant - Stopping...
echo.

REM Change to project root directory
cd /d "%~dp0\.."

REM Stop containers
docker compose -f docker/docker-compose.yml down

echo.
echo ✅ Bot stopped successfully
echo.
echo To start again, double-click scripts\start.bat
echo.
pause
