@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$link = Join-Path ([Environment]::GetFolderPath('Startup')) '새김AI 공방 열기.lnk';" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($link);" ^
  "$s.TargetPath = \"$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe\";" ^
  "$s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0공방_열기.ps1\"';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = '새김AI Atelier - 로컬 API 와 Cloudflare 터널을 켭니다';" ^
  "$s.Save();" ^
  "if (Test-Path -LiteralPath $link) { Write-Host '  등록했습니다. 로그인할 때마다 홈페이지가 자동으로 켜집니다.' } else { Write-Host '  등록 실패' }"
echo.
pause
