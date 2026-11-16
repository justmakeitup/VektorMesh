@echo off
title VektorMesh Stopper
cd /d "%~dp0"

echo ========================================================================
echo        STOPPING ALL VEKTORMESH PROCESSES
echo ========================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"

echo.
echo All VektorMesh ports and processes stopped.
pause
