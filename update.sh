#!/bin/sh
# Pull the latest changes from GitHub and restart the dashboard container.
# Run this script from the project directory after pushing updates.
#
# Usage:
#   ./update.sh
#
# To restart the container even if there are no changes (e.g. after editing config.js):
#   ./update.sh --restart

set -e

echo "==> Pulling latest changes..."
git pull

if [ "$1" = "--restart" ]; then
  echo "==> Restarting container (forced)..."
  docker compose restart
  echo "==> Done."
  exit 0
fi

# Check whether server.js was among the changed files; only restart if so.
CHANGED=$(git diff HEAD@{1} HEAD --name-only 2>/dev/null || echo "")

if echo "$CHANGED" | grep -q "server.js"; then
  echo "==> server.js changed — restarting container..."
  docker compose restart
else
  echo "==> Static files only — no restart needed. Changes are live."
fi

echo "==> Done."
