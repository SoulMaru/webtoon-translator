# 새김AI Atelier — 로컬 API 와 Cloudflare 터널을 켭니다.
# 이미 떠 있으면 다시 띄우지 않습니다. 시작프로그램에서도 이 파일을 씁니다.

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

function Test-LocalApi {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 3 | Out-Null
        return $true
    } catch { return $false }
}

if (Test-LocalApi) {
    Write-Host "로컬 API 는 이미 떠 있습니다." -ForegroundColor DarkGray
} else {
    Write-Host "로컬 API 를 켭니다..." -ForegroundColor Cyan
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit',
        '-File', (Join-Path $here 'start-local-api.ps1')
    )
}

function Test-Studio {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8788/api/state' -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $_.Exception.Response.StatusCode.value__ -eq 401
    }
}

if (Test-Studio) {
    Write-Host "만들기 콘솔은 이미 떠 있습니다." -ForegroundColor DarkGray
} else {
    Write-Host "만들기 콘솔을 켭니다..." -ForegroundColor Cyan
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit',
        '-File', (Join-Path $here 'start-studio.ps1')
    )
}

if (Get-Process cloudflared -ErrorAction SilentlyContinue) {
    Write-Host "터널은 이미 떠 있습니다." -ForegroundColor DarkGray
} else {
    Write-Host "터널을 켭니다..." -ForegroundColor Cyan
    Start-Process powershell.exe -WindowStyle Minimized -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit',
        '-File', (Join-Path $here 'start-tunnel.ps1')
    )
}

# 실제로 바깥에서 열리는지 확인합니다.
Write-Host ""
Write-Host "확인 중..." -NoNewline
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline
    if (Test-LocalApi) {
        Write-Host ""
        Write-Host "공방을 열었습니다. https://saegimai.com" -ForegroundColor Green
        exit 0
    }
}
Write-Host ""
Write-Host "로컬 API 가 뜨지 않았습니다. 최소화된 창을 열어 오류를 확인하십시오." -ForegroundColor Yellow
