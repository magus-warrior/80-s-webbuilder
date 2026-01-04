#!/usr/bin/env bash
set -euo pipefail

GUNICORN=$(which gunicorn)
BASH=$(which bash)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

exec "$GUNICORN" -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:5024
