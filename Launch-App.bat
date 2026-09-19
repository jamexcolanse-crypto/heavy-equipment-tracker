@echo off
title El Salvador City Motorpool - Heavy Equipment Tracker
echo ==================================================================
echo   El Salvador City Motorpool - Heavy Equipment Maintenance System
echo ==================================================================
echo.
echo Launching El Salvador City Motorpool app in Google Chrome...

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%~dp0index.html"
) else (
    start "" "%~dp0index.html"
)

echo App opened successfully!
timeout /t 3 >nul
exit
