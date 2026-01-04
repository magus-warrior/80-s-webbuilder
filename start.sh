#!/usr/bin/env bash
set -euo pipefail

UVICORN="@UVICORN_PATH@"
BASH=$(which bash)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

if [ ! -d "$ROOT_DIR/dist" ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is required to build the frontend but was not found in PATH." >&2
    echo "Install Node.js 18+ and rerun this script." >&2
    exit 1
  fi

  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
  if [ "$node_major" -lt 18 ]; then
    echo "Error: Node.js 18+ is required to run Vite builds." >&2
    echo "Detected Node.js $(node -p "process.versions.node"). Please upgrade Node.js." >&2
    exit 1
  fi

  npm run build
fi

exec "$UVICORN" main:app --host 0.0.0.0 --port 5024
