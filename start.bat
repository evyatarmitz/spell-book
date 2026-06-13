@echo off
cd /d "%~dp0"

set EXE=src-tauri\target\release\spell-book.exe

if not exist "%EXE%" (
  echo First run — building the app, this takes a few minutes...
  echo.
  call npx tauri build
)

start "" "%~dp0%EXE%"
