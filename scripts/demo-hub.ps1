#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$HubDocker = Resolve-Path (Join-Path $Root "..\ai-portfolio\docker")
$port = if ($env:AI_ASSISTANT_SDK_PORT) { $env:AI_ASSISTANT_SDK_PORT } else { "18080" }
$base = "http://localhost:${port}/ai-assistant"

Write-Host "=== AI Assistant SDK Hub Profile (port $port) ===" -ForegroundColor Cyan
Set-Location $HubDocker

docker compose -f docker-compose.profiles.yml --profile ai-assistant-sdk up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Running zero-key smoke..."
Set-Location $Root
node scripts/smoke-zero-key.mjs $base
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host @"

Hub demo ready (API only).
  Health:  $base/health
  Chat:    POST $base/chat  (503 without API key = routing OK)

Playground UI + SSE streaming:
  cd ai-assistant-vue-playground && npm run dev
  (proxy targets Hub $base)

Or full UI stack: .\scripts\demo-standalone.ps1  (port 3000)
Stop Hub: cd $HubDocker && docker compose -f docker-compose.profiles.yml --profile ai-assistant-sdk down
"@