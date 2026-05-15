$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed or not on PATH."
  Write-Host "Install Node 20+ from https://nodejs.org then run this script again."
  exit 1
}

Write-Host "Installing dependencies..."
npm install --no-audit --no-fund

Write-Host ""
Write-Host "Starting Vite on http://localhost:5173 — leave this window open."
npm run dev -w web
