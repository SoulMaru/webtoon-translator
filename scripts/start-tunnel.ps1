$ErrorActionPreference = "Stop"

$config = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (-not (Test-Path -LiteralPath $config)) {
    Write-Host "터널 설정이 아직 없습니다: $config" -ForegroundColor Yellow
    Write-Host "docs\02-터널-연결.md 를 먼저 따라 해 주십시오." -ForegroundColor Yellow
    Read-Host "엔터를 누르면 닫습니다"
    exit 1
}

Write-Host "Cloudflare 터널을 켭니다..." -ForegroundColor Cyan
cloudflared tunnel --config $config run
