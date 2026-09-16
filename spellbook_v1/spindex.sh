#!/usr/bin/env bash
# Single launch point for the sidecar tool. The Python interpreter (the shared CUDA venv, which
# lives in the master worktree because venvs are git-ignored and not copied into linked worktrees)
# is resolved HERE and nowhere else — if it ever moves, change this one line or set $SPINDEX_PYTHON.
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${SPINDEX_PYTHON:-C:/Users/USER/AI_Agency/the elephant project/prototype/.venv-cuda/Scripts/python.exe}"
if [ ! -x "$PY" ] && [ ! -f "$PY" ]; then
  echo "interpreter not found: $PY" >&2
  echo "set SPINDEX_PYTHON to a torch-enabled python, or fix the path in spindex.sh" >&2
  exit 1
fi
cd "$DIR"
exec "$PY" -m spindex "$@"
