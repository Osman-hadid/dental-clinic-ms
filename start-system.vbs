Set WshShell = CreateObject("WScript.Shell")

' Kill old Laravel
WshShell.Run "taskkill /F /IM php.exe", 0, True

' Kill old Node.js (Next.js)
WshShell.Run "taskkill /F /IM node.exe", 0, True

' Go to project folder
projectPath = "C:\Users\ArgAdmin\Desktop\full code\mis-laravel-next-generator-main"

' Start backend
WshShell.Run "cmd /c cd """ & projectPath & "\backend"" && php artisan serve", 0, False

' Start frontend
WshShell.Run "cmd /c cd """ & projectPath & "\frontend"" && npm run dev", 0, False

' Wait for a few seconds to let servers start
WScript.Sleep 8000

' Open browser
WshShell.Run "http://localhost:3000/en", 0, False