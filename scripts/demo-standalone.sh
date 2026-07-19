#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example (API key optional for zero-key smoke; required for live chat)."
fi

DIST="$ROOT/ai-assistant-vue-playground/dist/index.html"
if [[ ! -f "$DIST" ]]; then
  echo "Building ai-assistant-vue-playground/dist (required by demo web image)..."
  (
    cd ai-assistant-vue-playground
    npm install
    npm run build
  )
fi

echo "Starting docker-compose.demo.yml (project: ai-assistant-demo)..."
docker compose -f docker-compose.demo.yml up -d --build

echo "Running demo smoke (zero-key health + chat routing)..."
node scripts/smoke-demo-compose.mjs

WEB_PORT="${AI_ASSISTANT_WEB_PORT:-3000}"
cat <<EOF

Demo is up.
  Web UI:  http://localhost:${WEB_PORT}/
  Health:  http://localhost:${WEB_PORT}/ai-assistant/health

Add AI_ASSISTANT_API_KEY to .env and restart for live streaming chat.
Stop: docker compose -f docker-compose.demo.yml down
EOF
