@echo off
title Spectra - SEO & Sitemap Generator
cd /d "%~dp0"
echo Running Spectra SEO and Sitemap Generation...
node scripts/generate-seo.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Script encountered an error. Please ensure Node.js is installed.
    pause
    exit /b %errorlevel%
)
echo.
echo Process complete. Press any key to exit.
pause >nul
