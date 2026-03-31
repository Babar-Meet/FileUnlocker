@echo off
echo ==========================================
echo Starting FileUnlocker...
echo ==========================================

:: Start the application in a new terminal window or directly
echo [INFO] Starting Backend and Frontend...
echo [INFO] Access via http://localhost:5173

:: Use concurrently, or if not in dev, start them manually.
:: For convenience, running npm run dev from root.
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo [ERROR] An error occurred while starting the application.
    echo Please make sure you have run 'setup.bat' first.
    pause
    exit /b %ERRORLEVEL%
)

pause
