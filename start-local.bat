@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 tools\dev_server.py
) else (
    python tools\dev_server.py
)
pause
