@echo off
:: Run Laravel in background without opening a new window
cd backend
start /b php artisan serve >nul 2>&1

:: Run Next.js in background without opening a new window
cd ..\frontend
start /b npm run dev >nul 2>&1

:: Open browser
start http://localhost:3006