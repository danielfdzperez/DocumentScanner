#!/usr/bin/env sh
# Arranca la web en local (Linux/macOS). Usa Node si existe; si no, Python.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-8080}"
if command -v node >/dev/null 2>&1; then
  exec node LocalTest/serve.mjs "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  exec python3 LocalTest/serve.py "$PORT"
else
  echo "Hace falta Node.js o Python." >&2
  exit 1
fi
