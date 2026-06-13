@echo off
cd /d "%~dp0"

set APP=src-tauri\target\release\spell-book.exe
set CLI=src-tauri\target\release\sb.exe

if not exist "%APP%" (
  echo First run — building Spell Book, this takes a few minutes...
  echo.
  call npx tauri build
  if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
)

REM Install sb CLI to npm globals folder so it works from any terminal
if exist "%CLI%" (
  copy /y "%~dp0%CLI%" "%APPDATA%\npm\sb.exe" >nul 2>&1
)

start "" "%~dp0%APP%"
