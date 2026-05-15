@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install Node 20+ from https://nodejs.org then run this script again.
  pause
  exit /b 1
)

echo Installing dependencies (first run may take a minute)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Starting FRONTEND on http://localhost:5173  (leave this window open)
echo NOTE: If you see /api ECONNREFUSED errors, also run start-server.cmd in another window.
echo.
call npm run dev -w web
pause
