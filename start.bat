@echo off
title Multi-Checker Server
echo Starting Multi-Checker Server on port 5500...
echo.
echo The application will run in this window.
echo Keep this window open to use the application.
echo.
echo Access the application at: http://127.0.0.1:5500
echo Press Ctrl+C to stop the server.
echo.

python -m http.server 5500

pause
