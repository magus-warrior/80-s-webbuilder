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
  export VIRTUAL_ENV="$venv_dir"
  export PATH="$venv_dir/bin:$PATH"
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
  echo "uvicorn was not available after dependency install. Installing explicitly..." >&2
  "$python_cmd" -m pip install uvicorn
  uvicorn_path="$("$python_cmd" -c "import shutil; print(shutil.which('uvicorn') or '')")"
  if [ -z "$uvicorn_path" ]; then
    echo "Error: uvicorn is not available after dependency install." >&2
    echo "Ensure it is listed in requirements.txt or install it with pip." >&2
    exit 1
  fi
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
  service_user_default="${SUDO_USER:-$USER}"
  service_user=$(prompt_choice "Enter systemd service user (default: ${service_user_default}): " "$service_user_default")
  service_group_default="$(id -gn "$service_user" 2>/dev/null || echo "$service_user")"
  service_group=$(prompt_choice "Enter systemd service group (default: ${service_group_default}): " "$service_group_default")
  echo "Installing systemd service from deploy/demon-beauty.service..."
  service_tmp="$(mktemp)"
  sed -e "s|@ROOT_DIR@|$ROOT_DIR|g" \
      -e "s|@SERVICE_USER@|$service_user|g" \
      -e "s|@SERVICE_GROUP@|$service_group|g" \
      "$ROOT_DIR/deploy/demon-beauty.service" > "$service_tmp"
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

nginx_choice=$(prompt_choice "Configure Nginx reverse proxy + Certbot TLS? [y/N]: " "N")
if [[ "${nginx_choice,,}" == "y" ]]; then
  require_cmd sudo
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Error: apt-get is required to install Nginx/Certbot automatically." >&2
    exit 1
  fi

  domain_name=$(prompt_choice "Enter the domain name (e.g. example.com): " "")
  if [ -z "$domain_name" ]; then
    echo "Error: domain name is required to configure Nginx/Certbot." >&2
    exit 1
  fi

  admin_email=$(prompt_choice "Enter the certbot email address: " "")
  if [ -z "$admin_email" ]; then
    echo "Error: certbot email is required." >&2
    exit 1
  fi

  echo "Installing Nginx and Certbot..."
  sudo apt-get update
  sudo apt-get install -y nginx certbot python3-certbot-nginx

  echo "Configuring Nginx for $domain_name..."
  nginx_conf="/etc/nginx/sites-available/$domain_name"
  sudo tee "$nginx_conf" >/dev/null <<EOF
server {
    listen 80;
    server_name $domain_name;

    location / {
        proxy_pass http://127.0.0.1:5024;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  sudo ln -sf "$nginx_conf" "/etc/nginx/sites-enabled/$domain_name"
  if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm -f /etc/nginx/sites-enabled/default
  fi

  sudo nginx -t
  sudo systemctl reload nginx

  echo "Requesting TLS certificate with Certbot..."
  sudo certbot --nginx -d "$domain_name" --non-interactive --agree-tos -m "$admin_email"

  echo
  echo "Nginx configured with TLS. Next steps:"
  echo "- Verify renewals: sudo certbot renew --dry-run"
  echo "- Nginx status:    sudo systemctl status nginx"
fi

echo
echo "For reference, see README.md for installation steps."
