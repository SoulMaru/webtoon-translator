@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0공방_열기.ps1"
timeout /t 4 /nobreak >nul
