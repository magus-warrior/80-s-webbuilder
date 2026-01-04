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

if ! command -v psql >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "Installing PostgreSQL (apt-get)..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
  else
    echo "Error: PostgreSQL is required but no supported package manager was found." >&2
    echo "Install PostgreSQL and rerun this script." >&2
    exit 1
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable --now postgresql
fi

echo "Configuring PostgreSQL database..."
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER postgres WITH SUPERUSER;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='fastapi_app'" | grep -q 1 \
  || sudo -u postgres createdb -O postgres fastapi_app

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

mode_choice=$(prompt_choice "Install as systemd service or manual run? [systemd/manual] (systemd): " "systemd")
if [[ "${mode_choice,,}" == "systemd" ]] && command -v systemctl >/dev/null 2>&1; then
  echo "Installing systemd service from deploy/demon-beauty.service..."
  service_tmp="$(mktemp)"
  sed "s|@ROOT_DIR@|$ROOT_DIR|g" "$ROOT_DIR/deploy/demon-beauty.service" > "$service_tmp"
  sudo cp "$service_tmp" /etc/systemd/system/demon-beauty.service
  rm -f "$service_tmp"
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
