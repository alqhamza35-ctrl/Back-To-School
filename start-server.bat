@echo off
rem Back to School - start the local server + AI proxy. Double-click this file.
cd /d "%~dp0"
if not exist "gemini-key.json" echo [i] No gemini-key.json - the assistant will stay offline.
echo [i] Open http://localhost:8123  -  close this window to stop.
node server.js
pause
