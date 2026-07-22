#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example (explicit deterministic Demo provider; no external key required)."
}

Write-Host "Building and starting docker-compose.demo.yml from source (project: ai-assistant-demo)..."
docker compose -f docker-compose.demo.yml up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running demo smoke (health + blocking chat + SSE in explicit Demo mode)..."
node scripts/smoke-demo-compose.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$webPort = if ($env:AI_ASSISTANT_WEB_PORT) { $env:AI_ASSISTANT_WEB_PORT } else { "3000" }
Write-Host @"

Demo is up.
  Web UI:  http://localhost:${webPort}/
  Health:  http://localhost:${webPort}/ai-assistant/health

Demo mode already supports the full SSE path. Set provider/base URL/model/key in .env only for a real model.
Stop: docker compose -f docker-compose.demo.yml down
"@
