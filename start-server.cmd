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

if not exist ".env" if not exist "server\.env" (
  echo Missing .env file.
  echo Put DATABASE_URL + JWT_SECRET in either:
  echo   - project root:  .env
  echo   - server folder: server\.env
  echo.
  echo Copy .env.example to one of those paths. In Explorer, turn on
  echo "View ^> File name extensions" so the file is not saved as .env.txt
  echo.
  pause
  exit /b 1
)

echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Starting BACKEND API on http://localhost:4000 (leave this window open)
echo.
call npm run dev -w server
pause
