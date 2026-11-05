@echo off
REM Prefer WinLibs MinGW (has libgcc) over LLVM-MinGW when using windows-gnu toolchain.
set "WINLIBS=C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
if exist "%WINLIBS%\gcc.exe" set "PATH=%WINLIBS%;%PATH%"
cd /d "%~dp0.."
npm run tauri dev
