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

ensure_python() {
  if command -v python >/dev/null 2>&1; then
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    local install_choice
    install_choice=$(prompt_choice "Python not found. Install python3, venv, and pip via apt-get? [Y/n]: " "Y")
    if [[ "${install_choice,,}" == "y" ]]; then
      echo "Installing Python (apt-get)..."
      sudo apt-get update
      sudo apt-get install -y python3 python3-venv python3-pip
      return 0
    fi
  fi

  echo "Error: Python is required but was not found." >&2
  exit 1
}

prompt_choice() {
  local prompt="$1"
  local default="$2"
  local reply

  read -r -p "$prompt" reply
  reply="${reply:-$default}"
  printf '%s' "$reply"
}

cd "$ROOT_DIR"

ensure_python

python_cmd="python"
if ! command -v python >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  python_cmd="python3"
fi

venv_dir="$ROOT_DIR/.venv"
venv_choice=$(prompt_choice "Create/use virtualenv at $venv_dir? [Y/n]: " "Y")
if [[ "${venv_choice,,}" == "y" ]]; then
  if [ ! -d "$venv_dir" ]; then
    echo "Creating virtualenv..."
    "$python_cmd" -m venv "$venv_dir"
  fi
  python_cmd="$venv_dir/bin/python"
else
  echo "Error: virtualenv is required for installation." >&2
  exit 1
fi

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

echo "Installing backend dependencies (requirements.txt) into virtualenv..."
"$python_cmd" -m pip install --upgrade pip
"$python_cmd" -m pip install -r requirements.txt

uvicorn_path="$("$python_cmd" -c "import shutil; print(shutil.which('uvicorn') or '')")"
if [ -z "$uvicorn_path" ]; then
  echo "Error: uvicorn is not available after dependency install." >&2
  echo "Ensure it is listed in requirements.txt or install it with pip." >&2
  exit 1
fi

start_tmp="$(mktemp)"
sed "s|@UVICORN_PATH@|$uvicorn_path|g" "$ROOT_DIR/start.sh" > "$start_tmp"
mv "$start_tmp" "$ROOT_DIR/start.sh"
chmod +x "$ROOT_DIR/start.sh"

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
