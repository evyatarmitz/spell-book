@echo off
REM Single launch point (Windows). The interpreter path lives here and nowhere else; if the
REM shared CUDA venv moves, change this line or set SPINDEX_PYTHON.
setlocal
if "%SPINDEX_PYTHON%"=="" (
  set "PY=C:\Users\USER\AI_Agency\the elephant project\prototype\.venv-cuda\Scripts\python.exe"
) else (
  set "PY=%SPINDEX_PYTHON%"
)
if not exist "%PY%" (
  echo interpreter not found: %PY% 1>&2
  echo set SPINDEX_PYTHON to a torch-enabled python, or fix the path in spindex.cmd 1>&2
  exit /b 1
)
cd /d "%~dp0"
"%PY%" -m spindex %*
