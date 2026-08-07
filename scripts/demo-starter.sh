#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${AI_ASSISTANT_DEMO_PORT:-8080}"
cd "$ROOT"

echo "Building @ai-assistant/vue and Web Component assets..."
(
  cd ai-assistant-ui
  npm ci
  npm run build:publish
)

echo "Packaging the Starter host example..."
mvn -pl ai-assistant-demo -am -DskipTests package

JAR=""
for candidate in ai-assistant-demo/target/ai-assistant-demo-*.jar; do
  [[ -f "$candidate" ]] || continue
  if [[ -z "$JAR" || "$candidate" -nt "$JAR" ]]; then
    JAR="$candidate"
  fi
done
if [[ -z "$JAR" ]]; then
  echo "Starter Demo executable JAR was not found." >&2
  exit 1
fi

echo "Starting Starter demo on http://localhost:${PORT}/ (explicit Demo provider)."
exec java -jar "$JAR" "--server.port=${PORT}"
