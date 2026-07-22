#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Write-Warning "demo-hub.ps1 is a compatibility alias; starting the self-contained standalone demo."
& (Join-Path $PSScriptRoot "demo-standalone.ps1")
exit $LASTEXITCODE
