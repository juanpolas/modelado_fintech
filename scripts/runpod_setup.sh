#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/6] System dependencies"
sudo apt update
sudo apt install -y software-properties-common git curl tmux

if ! command -v python3.11 >/dev/null 2>&1; then
  sudo add-apt-repository -y ppa:deadsnakes/ppa || true
  sudo apt update
fi
sudo apt install -y python3.11 python3.11-venv python3-pip

if ! command -v node >/dev/null 2>&1; then
  echo "[2/6] Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "[3/6] Python dependencies"
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "[4/6] Frontend dependencies"
if [ -d frontend-next ]; then
  cd frontend-next
  npm install
  npm run build
elif [ -d frontend ]; then
  cd frontend
  npm install
  npm run build
else
  echo "No frontend directory found"
  exit 1
fi
cd "$ROOT_DIR"

echo "[5/6] Environment"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "[6/6] Next steps"
echo "- Edit .env and set APP_ACCESS_CODE"
echo "- Configure X_BEARER_TOKEN and NEWS_* vars in .env for live signals"
echo "- Start services: ./scripts/start_all.sh"
echo "- Or manually: ./scripts/start_backend.sh and ./scripts/start_frontend.sh"
