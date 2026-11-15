@echo off
rem Lao Hac game - Windows launcher (double-click)
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org roi chay lai. & pause & exit /b 1)
if not exist node_modules (
  echo Dang cai thu vien lan dau...
  call npm install || (pause & exit /b 1)
)
start "" "http://127.0.0.1:3939/admin/"
node server/index.js
pause
