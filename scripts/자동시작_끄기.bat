@echo off
chcp 65001 >nul
setlocal

set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\새김AI 공방 열기.lnk"

if exist "%LINK%" (
    del "%LINK%"
    echo.
    echo   해제했습니다. 이제 자동으로 켜지지 않습니다.
    echo   직접 켜시려면 공방_열기.bat 을 두 번 누르십시오.
) else (
    echo.
    echo   등록되어 있지 않습니다.
)
echo.
pause
