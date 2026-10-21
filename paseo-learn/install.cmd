@echo off
setlocal
node "%~dp0scripts\install.mjs" %*
exit /b %ERRORLEVEL%
