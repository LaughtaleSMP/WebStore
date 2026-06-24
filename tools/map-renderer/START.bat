@echo off
:: Silent launcher - hide this window and show only the app
:: Creates a VBScript to run node server hidden, then opens app window

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    msg * "Node.js tidak ditemukan! Download di https://nodejs.org"
    exit /b 1
)

:: Install dependencies jika belum ada
if not exist "node_modules" (
    npm install --silent
)

:: Create temp VBS to run node hidden
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\lt_launcher.vbs"
echo WshShell.Run "cmd /c cd /d ""%~dp0"" && node server.js", 0, False >> "%temp%\lt_launcher.vbs"

:: Launch node server hidden
cscript //nologo "%temp%\lt_launcher.vbs"

:: Wait for server to start
timeout /t 2 /nobreak >nul

:: Open as desktop app (no browser bar)
set LAUNCHED=0

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3847 --window-size=1280,800
    set LAUNCHED=1
)

if %LAUNCHED%==0 (
    where msedge >nul 2>nul
    if %errorlevel% equ 0 (
        start "" msedge --app=http://localhost:3847 --window-size=1280,800
        set LAUNCHED=1
    )
)

if %LAUNCHED%==0 (
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3847 --window-size=1280,800
        set LAUNCHED=1
    )
)

if %LAUNCHED%==0 (
    start http://localhost:3847
)

:: This batch exits immediately - node runs in background
exit
