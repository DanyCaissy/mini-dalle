@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo .env file not found.
  echo Copy .env.example to .env and set OPENAI_API_KEY first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Story Image Generator...
start "" http://localhost:3000
call npm start
