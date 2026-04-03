@echo off
PowerShell -WindowStyle Hidden -Command "Start-Process -FilePath '%~dp0DashboardJeux.exe' -WindowStyle Hidden"
timeout /t 2 /nobreak > nul
start http://localhost:3000
