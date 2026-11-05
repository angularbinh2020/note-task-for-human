@echo off
set "WINLIBS=C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
if exist "%WINLIBS%\gcc.exe" set "PATH=%WINLIBS%;%PATH%"
call rustup default stable-x86_64-pc-windows-gnu >nul
cd /d "%~dp0.."
call npm run tauri -- dev
