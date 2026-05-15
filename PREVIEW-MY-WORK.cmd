@echo off
title Oove / TradeOne - PREVIEW (keep this window open)
cd /d "%~dp0"

REM --- Find Node.js (double-click often has a shorter PATH than Cursor) ---
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo    NODE.JS WAS NOT FOUND
  echo  ============================================================
  echo.
  echo  Double-clicking this file uses a short PATH. Node may still
  echo  be installed but not visible here.
  echo.
  echo  FIX OPTION A  (recommended)
  echo    1. Go to https://nodejs.org
  echo    2. Download the LTS installer
  echo    3. Run it and CHECK the box: "Add to PATH"
  echo    4. Restart the computer (or at least log out and back in)
  echo    5. Double-click PREVIEW-MY-WORK.cmd again
  echo.
  echo  FIX OPTION B  (if you already use Node inside Cursor)
  echo    1. Open Cursor
  echo    2. Menu: Terminal - New Terminal
  echo    3. Run these two lines:
  echo         cd "%~dp0"
  echo         npm run dev -w web
  echo    4. Open browser: http://localhost:5173/start
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    PREVIEW YOUR WORK  (frontend only)
echo  ============================================================
echo.
echo  Step 1/3  Updating packages (wait until it finishes)...
echo.
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo  [X] npm install failed. Check internet connection, try again.
  echo.
  pause
  exit /b 1
)

echo.
echo  Step 2/3  Your browser will open in a few seconds...
echo            If it shows an error, wait 5 more seconds and refresh.
echo.
start "OpenPreview" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:5173/"

echo  Step 3/3  Starting the preview server...
echo.
echo  >>> KEEP THIS WINDOW OPEN while you work. <<<
echo  >>> Close it only when you are done previewing. <<<
echo.
echo  Preview URL:  http://localhost:5173/   (opens Quick Links first)
echo  (If the terminal shows a different port, use that URL instead.)
echo.
call npm run dev -w web

echo.
echo  Server stopped. Run this file again when you want to preview.
pause
