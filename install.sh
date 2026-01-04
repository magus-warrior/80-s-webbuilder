#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' not found in PATH." >&2
    exit 1
  fi
}

prompt_choice() {
  local prompt="$1"
  local default="$2"
  local reply

  read -r -p "$prompt" reply
  reply="${reply:-$default}"
  printf '%s' "$reply"
}

require_cmd python

cd "$ROOT_DIR"

echo "Installing backend dependencies (requirements.txt)..."
python -m pip install -r requirements.txt

if ! command -v gunicorn >/dev/null 2>&1; then
  echo "Error: gunicorn is not available after dependency install." >&2
  echo "Ensure it is listed in requirements.txt or install it with pip." >&2
  exit 1
fi

frontend_choice=$(prompt_choice "Install frontend dependencies with npm? [y/N]: " "N")
if [[ "${frontend_choice,,}" == "y" ]]; then
  require_cmd npm
  echo "Installing frontend dependencies (package.json)..."
  npm install
fi

mode_choice=$(prompt_choice "Install as systemd service or manual run? [systemd/manual] (manual): " "manual")
if [[ "${mode_choice,,}" == "systemd" ]]; then
  require_cmd systemctl
  echo "Installing systemd service from deploy/demon-beauty.service..."
  sudo cp "$ROOT_DIR/deploy/demon-beauty.service" /etc/systemd/system/demon-beauty.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now demon-beauty.service

  echo
  echo "Service installed and started. Next steps:"
  echo "- Check status: sudo systemctl status demon-beauty.service"
  echo "- Follow logs:  sudo journalctl -u demon-beauty.service -f"
else
  echo
  echo "Manual run selected. Next steps:"
  echo "- Start the app: $ROOT_DIR/start.sh"
  echo "- If you prefer systemd later, see README.md and deploy/demon-beauty.service"
fi

echo
echo "For reference, see README.md for installation steps."
