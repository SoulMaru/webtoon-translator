@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0..\local-api"

echo.
echo   ComfyUI 출력 폴더에서 새 이미지를 찾아 등록합니다.
echo.
node --env-file-if-exists=.env ingest.mjs
echo.
echo   등록된 작품은 아직 숨김 상태입니다.
echo   공개하려면 이 창에 다음처럼 치십시오:
echo       node admin.mjs list
echo       node admin.mjs title ^<슬러그^> "작품 이름"
echo       node admin.mjs show ^<슬러그^>
echo.
cmd /k
