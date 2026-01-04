#!/usr/bin/env bash
set -euo pipefail

UVICORN="@UVICORN_PATH@"
BASH=$(which bash)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

needs_build=false

if [ "${FORCE_BUILD:-}" = "1" ]; then
  needs_build=true
elif [ ! -d "$ROOT_DIR/dist" ]; then
  needs_build=true
else
  dist_index="$ROOT_DIR/dist/index.html"
  if [ ! -f "$dist_index" ]; then
    needs_build=true
  else
    latest_source_mtime=0
    while IFS= read -r -d '' file; do
      mtime=$(stat -c %Y "$file")
      if [ "$mtime" -gt "$latest_source_mtime" ]; then
        latest_source_mtime=$mtime
      fi
    done < <(find "$ROOT_DIR/src" -type f -print0)

    for file in "$ROOT_DIR/index.html" "$ROOT_DIR/package.json"; do
      if [ -f "$file" ]; then
        mtime=$(stat -c %Y "$file")
        if [ "$mtime" -gt "$latest_source_mtime" ]; then
          latest_source_mtime=$mtime
        fi
      fi
    done

    dist_mtime=$(stat -c %Y "$dist_index")
    if [ "$latest_source_mtime" -gt "$dist_mtime" ]; then
      needs_build=true
    fi
  fi
fi

if [ "$needs_build" = true ]; then
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
