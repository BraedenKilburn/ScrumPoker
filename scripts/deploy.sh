#!/bin/bash
set -Eeuo pipefail

PROJECT_DIR="$HOME/projects/ScrumPoker"
COMPOSE_FILE="docker-compose.prod.yml"
WWW_DIR="/var/www/scrum-poker"
STAGING_DIR="${WWW_DIR}-staging"
OLD_DIR="${WWW_DIR}-old"

BACKEND_SERVICE="backend"
# Compose names images "<project>-<service>"; project is the dir basename (scrumpoker).
BACKEND_IMAGE="scrumpoker-backend"
HEALTH_URL="http://127.0.0.1:3000/rooms/__deploy_healthcheck__"

# Track how far we got so cleanup only undoes what actually changed.
SUCCESS=0
BACKEND_SWAPPED=0
FRONTEND_SWAPPED=0
SUDO_KEEPALIVE_PID=""

log() { echo "[$(date +%H:%M:%S)] $*"; }

rollback() {
  log "Deployment failed. Rolling back..."

  # Restore the previous frontend if we already swapped it in.
  if [ "$FRONTEND_SWAPPED" -eq 1 ] && [ -d "$OLD_DIR" ]; then
    sudo rm -rf "$WWW_DIR"
    sudo mv "$OLD_DIR" "$WWW_DIR"
    sudo systemctl reload nginx || true
    log "Frontend rolled back."
  fi

  # Restore the previous backend image if we replaced it.
  if [ "$BACKEND_SWAPPED" -eq 1 ] && docker image inspect "${BACKEND_IMAGE}:rollback" >/dev/null 2>&1; then
    docker image tag "${BACKEND_IMAGE}:rollback" "${BACKEND_IMAGE}:latest"
    (cd "$PROJECT_DIR" && docker compose -f "$COMPOSE_FILE" up -d --no-build "$BACKEND_SERVICE") || true
    log "Backend rolled back to previous image."
  fi

  log "Rollback complete."
}

# Single exit handler: rollback on any failure (set -e / explicit exit), or
# tidy up rollback artifacts on success. Runs exactly once, on shell exit.
cleanup() {
  trap - EXIT
  # Stop the sudo keep-alive so it doesn't outlive the script.
  [ -n "$SUDO_KEEPALIVE_PID" ] && kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
  if [ "$SUCCESS" -eq 1 ]; then
    sudo rm -rf "$OLD_DIR"
    docker image rm "${BACKEND_IMAGE}:rollback" >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
  else
    rollback
  fi
}
trap cleanup EXIT

cd "$PROJECT_DIR"
log "Starting deployment of commit $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"

# Authenticate sudo once, up front, then refresh the credential in the
# background so no password prompt interrupts the (slow) build later.
# The keep-alive exits on its own if the script dies; cleanup() also kills it.
sudo -v
( while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done ) &
SUDO_KEEPALIVE_PID=$!

# 1. Build the frontend FIRST. A build failure aborts here, before the backend
#    is touched or anything is swapped — no half-deployed state.
log "Building frontend..."
cd "$PROJECT_DIR/frontend"
bun install --frozen-lockfile
bun run --bun build

log "Staging frontend..."
sudo rm -rf "$STAGING_DIR"
sudo cp -r "$PROJECT_DIR/frontend/dist" "$STAGING_DIR"
sudo chown -R www-data:www-data "$STAGING_DIR"

# 2. Rebuild the backend image, tagging the current one as a rollback target.
cd "$PROJECT_DIR"
log "Rebuilding backend..."
docker image tag "${BACKEND_IMAGE}:latest" "${BACKEND_IMAGE}:rollback" 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" build "$BACKEND_SERVICE"

log "Restarting backend..."
docker compose -f "$COMPOSE_FILE" up -d "$BACKEND_SERVICE"
BACKEND_SWAPPED=1

# 3. Verify the new backend actually serves before pointing users at it.
log "Waiting for backend health..."
for i in $(seq 1 15); do
  if curl -fsS -m 2 -o /dev/null "$HEALTH_URL"; then
    log "Backend healthy."
    break
  fi
  if [ "$i" -eq 15 ]; then
    log "Backend failed health check after 15s."
    exit 1
  fi
  sleep 1
done

# 4. Swap the new frontend in last, so the frontend and backend flip together
#    (minimises the window where an old frontend talks to a new backend).
log "Deploying frontend..."
sudo rm -rf "$OLD_DIR"
if [ -d "$WWW_DIR" ]; then
  sudo mv "$WWW_DIR" "$OLD_DIR"
fi
sudo mv "$STAGING_DIR" "$WWW_DIR"
FRONTEND_SWAPPED=1

log "Reloading Nginx..."
sudo nginx -t
sudo systemctl reload nginx

SUCCESS=1
log "Deployment complete at $(date)"
