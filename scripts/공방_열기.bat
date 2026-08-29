@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   새김AI Atelier - 공방을 엽니다
echo   ----------------------------------
echo   창 두 개가 열립니다. 홈페이지를 내리려면 두 창을 닫으십시오.
echo.

start "Atelier 로컬 API" powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start-local-api.ps1"
start "Atelier 터널"     powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start-tunnel.ps1"

echo   열었습니다. https://saegimai.com 에서 확인하십시오.
timeout /t 4 /nobreak >nul
exit /b 0
