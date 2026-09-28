@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title QuestForge - Interactive Story and Narrative Authoring

:: Help command
if /i "%1"=="help" goto :show_help
if /i "%1"=="-h" goto :show_help
if /i "%1"=="--help" goto :show_help

:: Activate virtual environment if present and no active env
if not defined VIRTUAL_ENV (
    if not defined CONDA_PREFIX (
        if exist ".venv\Scripts\activate.bat" (
            call .venv\Scripts\activate.bat
        )
    )
)

:: Check if .env exists
if not exist ".env" (
    if exist ".env.example" (
        echo [*] Initializing .env from .env.example...
        copy .env.example .env >nul
    )
)

:: Check if frontend dist exists
if not exist "designer\dist\index.html" (
    echo [!] Designer frontend bundle not found in designer\dist.
    echo [*] Building Designer frontend bundle...
    cd designer
    call npm run build
    cd /d "%~dp0"
)

:: Mode switch: dev
if /i "%1"=="dev" (
    echo ===================================================
    echo       Starting QuestForge in Development Mode
    echo ===================================================
    echo [*] Launching FastAPI backend on http://127.0.0.1:8000 in background...
    start "QuestForge API Backend" cmd /k "cd /d "%~dp0" && if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat && python -m uvicorn pipeline.api.server:app --host 127.0.0.1 --port 8000 --reload"
    echo [*] Launching Vite development server with HMR on http://localhost:5173...
    cd designer
    start "" http://localhost:5173
    call npm run dev
    cd /d "%~dp0"
    exit /b 0
)

:: Mode switch: cli
if /i "%1"=="cli" (
    echo ===================================================
    echo       Starting QuestForge Terminal Reviewer CLI
    echo ===================================================
    python -m pipeline.cli %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %errorlevel%
)

:: Default mode: Unified Web App (FastAPI serving API + built Designer UI)
echo ===================================================
echo                   QuestForge
echo       Interactive Story and Narrative Authoring
echo ===================================================
echo.
echo [*] Server URL: http://127.0.0.1:8000
echo [*] Press Ctrl+C in this window to stop the server.
echo.
echo [*] Opening QuestForge in your default browser...
start "" http://127.0.0.1:8000

echo [*] Starting unified backend server...
python -m uvicorn pipeline.api.server:app --host 127.0.0.1 --port 8000
exit /b %errorlevel%

:show_help
echo ===================================================
echo             QuestForge Launcher Usage
echo ===================================================
echo.
echo   run.bat          - Launch unified Web App on http://127.0.0.1:8000
echo                      (Serves both backend API and built Visual Designer)
echo.
echo   run.bat dev      - Launch development mode
echo                      (Backend on :8000 + Vite hot-reloading dev server on :5173)
echo.
echo   run.bat cli      - Launch interactive terminal reviewer CLI
echo                      (e.g., run.bat cli --seed "Your story idea")
echo.
echo   run.bat help     - Display this help message
echo.
exit /b 0
