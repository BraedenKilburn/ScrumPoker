#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="$HOME/projects/ScrumPoker"
WWW_DIR="/var/www/scrum-poker"
STAGING_DIR="${WWW_DIR}-staging"
OLD_DIR="${WWW_DIR}-old"

rollback() {
  echo "Deployment failed. Attempting rollback..."

  if [ -d "$OLD_DIR" ] && [ ! -d "$WWW_DIR" ]; then
    sudo mv "$OLD_DIR" "$WWW_DIR"
    sudo systemctl reload nginx || true
  fi

  echo "Rollback complete."
}

trap rollback ERR

echo "Starting deployment at $(date)"

cd "$PROJECT_DIR"

echo "Rebuilding backend..."
docker compose -f docker-compose.prod.yml up --build -d backend

echo "Building frontend..."
cd "$PROJECT_DIR/frontend"
bun install --frozen-lockfile
bun run --bun build

echo "Deploying frontend..."
sudo rm -rf "$STAGING_DIR"
sudo cp -r "$PROJECT_DIR/frontend/dist" "$STAGING_DIR"
sudo chown -R www-data:www-data "$STAGING_DIR"

sudo rm -rf "$OLD_DIR"
if [ -d "$WWW_DIR" ]; then
  sudo mv "$WWW_DIR" "$OLD_DIR"
fi

sudo mv "$STAGING_DIR" "$WWW_DIR"
sudo rm -rf "$OLD_DIR"

echo "Reloading Nginx..."
sudo systemctl reload nginx

trap - ERR
echo "Deployment complete at $(date)"
