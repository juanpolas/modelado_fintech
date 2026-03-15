#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend-next"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local
fi

export PORT="${FRONTEND_PORT:-3000}"
exec npm run dev
