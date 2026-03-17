@echo off
setlocal

where node >nul 2>nul
if %errorlevel%==0 (
    echo [INFO] Node.js is already installed.
    node -v
    echo [INFO] No additional npm dependencies are required.
    pause
    exit /b 0
)

echo [WARNING] Node.js was not found.
echo [INFO] Trying to install Node.js with winget...
where winget >nul 2>nul
if not %errorlevel%==0 (
    echo [ERROR] winget was not found. Please install Node.js manually:
    echo https://nodejs.org/
    pause
    exit /b 1
)

winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo [ERROR] Automatic Node.js installation failed.
    echo [INFO] Please install Node.js manually:
    echo https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Installation finished. Close this window and run ZAPUSK.bat again.
pause
