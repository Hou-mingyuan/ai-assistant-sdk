#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Port = if ($env:AI_ASSISTANT_DEMO_PORT) { $env:AI_ASSISTANT_DEMO_PORT } else { "8080" }
Set-Location $Root

Write-Host "Building @ai-assistant/vue and Web Component assets..."
Push-Location (Join-Path $Root "ai-assistant-ui")
npm.cmd ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm.cmd run build:publish
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host "Packaging the Starter host example..."
mvn.cmd -pl ai-assistant-demo -am -DskipTests package
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Jar = Get-ChildItem (Join-Path $Root "ai-assistant-demo\target") `
  -Filter "ai-assistant-demo-*.jar" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $Jar) { throw "Starter Demo executable JAR was not found." }
Write-Host "Starting Starter demo on http://localhost:$Port/ (explicit Demo provider)."
& java -jar $Jar.FullName "--server.port=$Port"
exit $LASTEXITCODE
