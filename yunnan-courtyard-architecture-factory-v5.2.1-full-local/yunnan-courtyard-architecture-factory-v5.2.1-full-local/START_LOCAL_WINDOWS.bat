@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py -3 tools\serve.py) || (python tools\serve.py)
pause
