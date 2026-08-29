$ErrorActionPreference = "Stop"
$api = Join-Path (Split-Path -Parent $PSScriptRoot) "local-api"
Set-Location -LiteralPath $api
Write-Host "새김AI Atelier 만들기 콘솔을 켭니다..." -ForegroundColor Cyan
Write-Host "이 포트(8788)는 공개 갤러리 API(8787)와 분리되어 있습니다." -ForegroundColor DarkGray
node --env-file-if-exists=.env studio-server.mjs
