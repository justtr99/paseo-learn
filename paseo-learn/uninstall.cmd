@echo off
setlocal
node "%~dp0scripts\uninstall.mjs" %*
exit /b %ERRORLEVEL%
