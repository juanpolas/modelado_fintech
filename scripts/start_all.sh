#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux not installed. Install tmux or run scripts/start_backend.sh and scripts/start_frontend.sh separately."
  exit 1
fi

SESSION_NAME="mirofish-fintech"
tmux new-session -d -s "$SESSION_NAME" -n backend "cd '$ROOT_DIR' && ./scripts/start_backend.sh"
tmux split-window -h -t "$SESSION_NAME" "cd '$ROOT_DIR' && ./scripts/start_frontend.sh"
tmux select-layout -t "$SESSION_NAME" even-horizontal

echo "Started in tmux session: $SESSION_NAME"
echo "Attach with: tmux attach -t $SESSION_NAME"
