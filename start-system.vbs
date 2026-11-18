Set WshShell = CreateObject("WScript.Shell")
Set FileSystem = CreateObject("Scripting.FileSystemObject")

' Kill old Laravel
WshShell.Run "taskkill /F /IM php.exe", 0, True

' Kill old Node.js (Next.js)
WshShell.Run "taskkill /F /IM node.exe", 0, True

' Resolve the project folder from this script location
projectPath = FileSystem.GetParentFolderName(WScript.ScriptFullName)

' Start backend
WshShell.Run "cmd /d /c cd /d """ & projectPath & "\backend"" && php artisan serve --host=127.0.0.1 --port=8000", 0, False

' Start Laravel scheduler (backups, report snapshots, pruning, cache warming)
WshShell.Run "cmd /d /c cd /d """ & projectPath & "\backend"" && php artisan schedule:work", 0, False

' Start frontend
WshShell.Run "cmd /d /c cd /d """ & projectPath & "\frontend"" && npm run dev", 0, False

' Wait for a few seconds to let servers start
WScript.Sleep 8000

' Open browser
WshShell.Run "http://localhost:3000/en", 0, False
