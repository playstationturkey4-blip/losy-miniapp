@echo off
chcp 65001 >nul
echo ==========================================
echo  Starting LOSY Mini App...
echo ==========================================
start "" "http://localhost:8000"
start "" "http://127.0.0.1:8000"
python serve.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying with py...
    py serve.py
)
pause
