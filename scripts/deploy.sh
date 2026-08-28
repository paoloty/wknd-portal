#!/usr/bin/env bash
# scripts/deploy.sh — push local commits and deploy to production.
#
# Usage:
#   ./scripts/deploy.sh
#
# What it does: pushes the current branch, then SSHes into the production
# box and runs git pull + npm install + pm2 restart there.
#
# Requires:
#   - A clean working tree. Commit your changes first — deploy always pushes
#     exactly what's committed, never a surprise mix of that plus whatever's
#     sitting uncommitted in your working tree.
#   - SSH access to root@wkndbasketball.com already working the way it does
#     when you SSH in by hand. If your key is passphrase-protected and no
#     ssh-agent is running, this will pause and prompt for it like any other
#     `ssh` command — run `ssh-add ~/.ssh/id_ed25519` first (once per shell
#     session) if you want it to run start-to-finish with no prompts.

set -euo pipefail

REMOTE_HOST="root@wkndbasketball.com"
REMOTE_PATH="/opt/wknd-portal"
PM2_NAME="wknd-portal"

if [ -n "$(git status --porcelain)" ]; then
  echo "Uncommitted changes present — commit (or stash) them first. Deploy pushes exactly what's committed, nothing more." >&2
  git status --short
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "== Pushing $BRANCH to origin =="
git push origin "$BRANCH"

echo "== Deploying on $REMOTE_HOST:$REMOTE_PATH =="
ssh "$REMOTE_HOST" bash -s <<EOF
set -euo pipefail
cd "$REMOTE_PATH"
echo "-- git pull --"
git pull
echo "-- npm install --"
npm install
echo "-- pm2 restart $PM2_NAME --"
pm2 restart "$PM2_NAME"
echo "-- pm2 status --"
pm2 status "$PM2_NAME"
EOF

echo "== Deploy complete =="
