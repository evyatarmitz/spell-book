@echo off
cd /d "%~dp0"

set APP=src-tauri\target\release\spell-book.exe
set CLI=src-tauri\target\release\sb.exe
set CARGO=%USERPROFILE%\.cargo\bin\cargo.exe

REM ── Install Rust if missing ───────────────────────────────────────────────────
if not exist "%CARGO%" (
  echo Rust not found. Installing via winget — takes about 2 minutes...
  echo.
  winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Failed. Install Rust manually from https://rustup.rs then re-run this file.
    pause & exit /b 1
  )
)
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM ── Install Tauri CLI if missing ──────────────────────────────────────────────
"%CARGO%" tauri --version >nul 2>&1
if errorlevel 1 (
  echo Installing Tauri CLI — one-time, takes a few minutes...
  "%CARGO%" install tauri-cli --version "^2" --locked
  if errorlevel 1 ( echo Tauri CLI install failed. & pause & exit /b 1 )
)

REM ── Build app on first run ────────────────────────────────────────────────────
if not exist "%APP%" (
  echo Building Spell Book — first run takes a few minutes...
  echo.
  pushd src-tauri
  "%CARGO%" tauri build
  if errorlevel 1 ( popd & echo Build failed. & pause & exit /b 1 )
  popd
)

REM ── Drop sb CLI into cargo bin so it works from any terminal ─────────────────
if exist "%CLI%" (
  copy /y "%~dp0%CLI%" "%USERPROFILE%\.cargo\bin\sb.exe" >nul 2>&1
)

start "" "%~dp0%APP%"
