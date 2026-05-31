@echo off
cd /d "%~dp0"

REM Kill previous instance if one is still running
if exist .server.pid (
  set /p PREV_PID=<.server.pid
  taskkill /f /pid %PREV_PID% >nul 2>&1
  del .server.pid >nul 2>&1
)

echo.
echo  ★ Spell Book   http://localhost:3333
echo  Close this window to stop the server.
echo.

start "" "http://localhost:3333"
node server.js
