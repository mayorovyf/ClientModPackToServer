@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found.
    echo [INFO] Please run "Ustanovka Zavisimostey.bat" first.
    pause
    exit /b 1
)

node "%SCRIPT_DIR%mine.js"
echo.
pause
