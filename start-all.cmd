@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo Missing .env file.
  echo Create it first:
  echo   copy .env.example .env
  echo then set DATABASE_URL and JWT_SECRET.
  pause
  exit /b 1
)

start "Trading App Backend" cmd /k "cd /d %~dp0 && start-server.cmd"
timeout /t 2 >nul
start "Trading App Frontend" cmd /k "cd /d %~dp0 && start-dev.cmd"

echo.
echo Open this in your browser:
echo   http://localhost:5173/
echo.
echo Keep both command windows open.
pause
