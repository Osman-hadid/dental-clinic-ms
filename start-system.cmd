@echo off
:: Kill old servers
taskkill /F /IM php.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 >nul

:: Go to project root
cd /d "C:\Users\ArgAdmin\Desktop\full code\mis-laravel-next-generator-main"

:: Start concurrently
start "" /b npm run dev

:: Wait until Next.js port 3000 is ready
:waitloop
timeout /t 1 >nul
powershell -command "try { $r=Invoke-WebRequest http://localhost:3000/en -UseBasicParsing; exit 0 } catch { exit 1 }"
if %ERRORLEVEL% neq 0 goto waitloop

:: Open browser after server is ready
start "" http://localhost:3000/en
exit