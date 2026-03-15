#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer the new Next.js dashboard frontend.
if [ -d "$ROOT_DIR/frontend-next" ]; then
  cd "$ROOT_DIR/frontend-next"
  if [ ! -d node_modules ]; then
    npm install
  fi
  export PORT="${FRONTEND_PORT:-3000}"
  exec npm run dev
fi

# Fallback to legacy Vue frontend when frontend-next is unavailable.
cd "$ROOT_DIR/frontend"
npm install
exec npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT:-5173}"
