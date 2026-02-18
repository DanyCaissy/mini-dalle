@echo off
setlocal

set "PORT=3000"
set "FOUND=0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set "FOUND=1"
  echo Stopping process %%P on port %PORT%...
  taskkill /PID %%P /F >nul 2>&1
)

if "%FOUND%"=="0" (
  echo No running server found on port %PORT%.
) else (
  echo Server stopped.
)

timeout /t 2 >nul
