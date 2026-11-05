@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
echo ===== LIB =====
echo %LIB%
echo ===== looking for kernel32.lib =====
where /R "C:\Program Files (x86)\Windows Kits" kernel32.lib 2>nul
where /R "C:\Program Files\Windows Kits" kernel32.lib 2>nul
echo ===== done =====
