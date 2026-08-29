$ErrorActionPreference = "Stop"
$api = Join-Path (Split-Path -Parent $PSScriptRoot) "local-api"
Set-Location -LiteralPath $api
Write-Host "새김AI Atelier 로컬 API를 켭니다..." -ForegroundColor Cyan
node --env-file-if-exists=.env server.mjs
