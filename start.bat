@echo off
cd /d "%~dp0"

set APP=%~dp0spell-book.exe
set SB=%~dp0sb.exe
set REPO=https://github.com/evyatarmitz/spell-book/releases/latest/download

REM ── Download app if not present ───────────────────────────────────────────────
if not exist "%APP%" (
  echo Downloading Spell Book...
  powershell -Command "Invoke-WebRequest -Uri '%REPO%/spell-book.exe' -OutFile '%APP%'" 2>nul
  if not exist "%APP%" (
    echo Download failed. Check your internet connection or download manually from:
    echo https://github.com/evyatarmitz/spell-book/releases/latest
    pause & exit /b 1
  )
)

REM ── Download sb CLI if not present ────────────────────────────────────────────
if not exist "%SB%" (
  echo Downloading sb CLI...
  powershell -Command "Invoke-WebRequest -Uri '%REPO%/sb.exe' -OutFile '%SB%'" 2>nul
)

REM ── Add sb to PATH for this session + optionally persist ─────────────────────
set PATH=%~dp0;%PATH%

start "" "%APP%"
