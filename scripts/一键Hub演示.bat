@echo off
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0demo-hub.ps1"
exit /b %ERRORLEVEL%
