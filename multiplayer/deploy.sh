#!/usr/bin/env bash
# Deploy the MiniCraft MP server to a VPS over SSH — key-based auth only.
# NO credentials are stored in this repo (unlike deploy-mini-mp.py which is
# left untouched by owner's request). Set up `ssh-copy-id user@host` first.
#
# Usage:
#   SSH_HOST=root@103.253.75.161 ./deploy.sh
#   SSH_HOST=root@103.253.75.161 SSH_PORT=22 REMOTE_DIR=/opt/minicraft-mp ./deploy.sh
#
# What it does:
#   1. Uploads server.js + package files + systemd unit + multiplayer.html
#   2. npm install on the server
#   3. Installs + restarts the minicraft-mp systemd service (auto-restart, boot-enabled)
set -euo pipefail

SSH_HOST="${SSH_HOST:?Set SSH_HOST=user@host (requires SSH key auth)}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/minicraft-mp}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo ">>> Uploading files to ${SSH_HOST}:${REMOTE_DIR}"
ssh -p "$SSH_PORT" "$SSH_HOST" "mkdir -p ${REMOTE_DIR}"
scp -P "$SSH_PORT" \
  "$HERE/server/server.js" \
  "$HERE/server/package.json" \
  "$HERE/server/package-lock.json" \
  "$SSH_HOST:${REMOTE_DIR}/"
scp -P "$SSH_PORT" "$HERE/deploy/multiplayer.html" "$SSH_HOST:${REMOTE_DIR}/multiplayer.html"

echo ">>> Installing systemd unit"
scp -P "$SSH_PORT" "$HERE/server/minicraft-mp.service" "$SSH_HOST:/etc/systemd/system/minicraft-mp.service"

echo ">>> Installing dependencies"
ssh -p "$SSH_PORT" "$SSH_HOST" "cd ${REMOTE_DIR} && (npm ci --omit=dev 2>/dev/null || npm install --omit=dev)"

echo ">>> Enabling + (re)starting service"
ssh -p "$SSH_PORT" "$SSH_HOST" "systemctl daemon-reload && systemctl enable minicraft-mp && systemctl restart minicraft-mp && sleep 1 && systemctl status minicraft-mp --no-pager | head -12"

echo ""
echo ">>> Done. Useful commands:"
echo "    logs:    ssh -p $SSH_PORT $SSH_HOST 'journalctl -u minicraft-mp -f'"
echo "    token:   ssh -p $SSH_PORT $SSH_HOST 'journalctl -u minicraft-mp -n 30 | grep \"Admin token\"'"
echo "    worlds:  ssh -p $SSH_PORT $SSH_HOST 'ls ${REMOTE_DIR}/worlds'"
