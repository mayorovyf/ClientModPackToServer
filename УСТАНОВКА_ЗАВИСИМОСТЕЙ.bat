@echo off
chcp 65001 >nul
title Client to Server - Установка зависимостей

echo.
echo   ╔═══════════════════════════════════════════╗
echo   ║         CLIENT TO SERVER                  ║
echo   ║   Создатель: F_aN │ Алексей               ║
echo   ║   Телеграм: t.me/F_aN_N                   ║
echo   ╚═══════════════════════════════════════════╝
echo.

echo [*] Проверка наличия Node.js...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не установлен!
    echo.
    echo Пожалуйста, скачайте и установите Node.js с сайта:
    echo https://nodejs.org/
    echo.
    echo После установки перезапустите этот скрипт.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js найден!
echo.

echo [*] Установка зависимостей...
echo.

cd /d "%~dp0"
call npm install

echo.
echo   ╔═══════════════════════════════════════════╗
echo   ║   Установка зависимостей завершена,       ║
echo   ║   можете закрыть окно                     ║
echo   ╚═══════════════════════════════════════════╝
echo.

pause