@echo off
:: Stop the Laughtale Dashboard server
echo Stopping Laughtale Dashboard...
taskkill /f /im node.exe /fi "WINDOWTITLE eq *server.js*" >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3847 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)
echo Done.
timeout /t 2 /nobreak >nul
