#!/usr/bin/env bash
set -euo pipefail

UVICORN="@UVICORN_PATH@"
BASH=$(which bash)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

exec "$UVICORN" main:app --host 0.0.0.0 --port 5024
