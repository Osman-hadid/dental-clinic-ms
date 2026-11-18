@echo off
setlocal
:: Kill old servers
taskkill /F /IM php.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

:: Resolve this script's folder so the project can be moved to another location
set "PROJECT_ROOT=%~dp0"

:: Start Laravel API
start "Sourire Laravel" /b cmd /d /c "cd /d ""%PROJECT_ROOT%backend"" && php artisan serve --host=127.0.0.1 --port=8000"

:: Start Laravel scheduler (backups, report snapshots, pruning, cache warming)
start "Sourire Scheduler" /b cmd /d /c "cd /d ""%PROJECT_ROOT%backend"" && php artisan schedule:work"

:: Start Next.js frontend
start "Sourire Next.js" /b cmd /d /c "cd /d ""%PROJECT_ROOT%frontend"" && npm run dev"

:: Wait until both services are ready (maximum 60 seconds)
set /a ATTEMPTS=0
:waitloop
timeout /t 1 >nul
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8000/up -UseBasicParsing -TimeoutSec 2 | Out-Null; Invoke-WebRequest http://127.0.0.1:3000/en -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %ERRORLEVEL% equ 0 goto ready
set /a ATTEMPTS+=1
if %ATTEMPTS% geq 60 (
    echo Sourire did not become ready within 60 seconds.
    exit /b 1
)
goto waitloop

:ready
:: Open browser after server is ready
start "" http://127.0.0.1:3000/en
exit
