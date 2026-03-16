@echo off
chcp 65001 >nul
title Client to Server

cd /d "%~dp0"

echo.
echo   ╔═══════════════════════════════════════════╗
echo   ║         CLIENT TO SERVER                  ║
echo   ║   Создатель: F_aN │ Алексей               ║
echo   ║   Телеграм: t.me/F_aN_N                   ║
echo   ╚═══════════════════════════════════════════╝
echo.

echo [*] Проверка зависимостей...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo Запустите сначала УСТАНОВКА_ЗАВИСИМОСТЕЙ.bat
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    if not exist "package-lock.json" (
        echo [ВНИМАНИЕ] Зависимости не установлены!
        echo Запустите сначала УСТАНОВКА_ЗАВИСИМОСТЕЙ.bat
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Все зависимости в порядке!
echo.

node index.js

pause