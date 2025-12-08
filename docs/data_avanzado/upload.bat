@echo off
echo 🚀 Ejecutando subida a GitHub...
powershell -ExecutionPolicy Bypass -File "%~dp0upload_to_github.ps1"
pause
