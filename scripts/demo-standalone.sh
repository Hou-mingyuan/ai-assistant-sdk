#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example (explicit deterministic Demo provider; no external key required)."
fi

echo "Building and starting docker-compose.demo.yml from source (project: ai-assistant-demo)..."
docker compose -f docker-compose.demo.yml up -d --build

echo "Running demo smoke (health + blocking chat + SSE in explicit Demo mode)..."
node scripts/smoke-demo-compose.mjs

WEB_PORT="${AI_ASSISTANT_WEB_PORT:-3000}"
cat <<EOF

Demo is up.
  Web UI:  http://localhost:${WEB_PORT}/
  Health:  http://localhost:${WEB_PORT}/ai-assistant/health

Demo mode already supports the full SSE path. Set provider/base URL/model/key in .env only for a real model.
Stop: docker compose -f docker-compose.demo.yml down
EOF
