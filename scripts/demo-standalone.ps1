#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example (API key optional for zero-key smoke; required for live chat)."
}

$dist = Join-Path $Root "ai-assistant-vue-playground\dist\index.html"
if (-not (Test-Path $dist)) {
  Write-Host "Building ai-assistant-vue-playground\dist (required by demo web image)..."
  Push-Location (Join-Path $Root "ai-assistant-vue-playground")
  npm install
  npm run build
  Pop-Location
}

Write-Host "Starting docker-compose.demo.yml (project: ai-assistant-demo)..."
docker compose -f docker-compose.demo.yml up -d --build

Write-Host "Running demo smoke (zero-key health + chat routing)..."
node scripts/smoke-demo-compose.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$webPort = if ($env:AI_ASSISTANT_WEB_PORT) { $env:AI_ASSISTANT_WEB_PORT } else { "3000" }
Write-Host @"

Demo is up.
  Web UI:  http://localhost:${webPort}/
  Health:  http://localhost:${webPort}/ai-assistant/health

Add AI_ASSISTANT_API_KEY to .env and restart for live streaming chat.
Stop: docker compose -f docker-compose.demo.yml down
"@
