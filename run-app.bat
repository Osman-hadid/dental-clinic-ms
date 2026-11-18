@echo off
setlocal
set "PROJECT_ROOT=%~dp0"

:: Run Laravel in background without opening a new window
start "Sourire Laravel" /b cmd /d /c "cd /d ""%PROJECT_ROOT%backend"" && php artisan serve --host=127.0.0.1 --port=8000"

:: Run Laravel scheduler for automatic backups and report snapshots
start "Sourire Scheduler" /b cmd /d /c "cd /d ""%PROJECT_ROOT%backend"" && php artisan schedule:work"

:: Run Next.js in background without opening a new window
start "Sourire Next.js" /b cmd /d /c "cd /d ""%PROJECT_ROOT%frontend"" && npm run dev"

:: Open browser
start http://127.0.0.1:3000
