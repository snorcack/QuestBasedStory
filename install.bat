@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

title QuestForge - Installation

echo ===================================================
echo             QuestForge Installer
echo ===================================================
echo.

:: 1. Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org and ensure "Add Python to PATH" is checked.
    echo.
    pause
    exit /b 1
)

:: 2. Check Node & npm
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js LTS 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo.
    pause
    exit /b 1
)

:: 3. Setup Python Environment
if defined VIRTUAL_ENV (
    echo [*] Active virtual environment detected: %VIRTUAL_ENV%
) else if defined CONDA_PREFIX (
    echo [*] Active Conda environment detected: %CONDA_PREFIX%
) else if exist ".venv\Scripts\activate.bat" (
    echo [*] Activating existing .venv virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo [*] Creating virtual environment .venv...
    python -m venv .venv
    if exist ".venv\Scripts\activate.bat" (
        call .venv\Scripts\activate.bat
    ) else (
        echo [WARNING] Could not create .venv; using current Python.
    )
)

:: 4. Install Python Dependencies
echo.
echo [*] Installing Python dependencies from requirements.txt...
python -m pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    echo.
    pause
    exit /b 1
)

:: 5. Setup .env configuration
echo.
if not exist ".env" (
    if exist ".env.example" (
        echo [*] Creating .env from .env.example...
        copy .env.example .env >nul
        echo [*] Created .env configuration file with default settings.
    )
) else (
    echo [*] Existing .env file found. Preserved.
)

:: 6. Setup Frontend Designer
echo.
echo [*] Setting up Designer frontend (designer/)...
cd designer
if errorlevel 1 (
    echo [ERROR] Failed to enter designer directory.
    pause
    exit /b 1
)

echo [*] Installing Node packages...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    cd /d "%~dp0"
    pause
    exit /b 1
)

echo [*] Building Designer frontend bundle (dist/)...
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build failed.
    cd /d "%~dp0"
    pause
    exit /b 1
)
cd /d "%~dp0"

echo.
echo ===================================================
echo         Installation Completed Successfully!
echo ===================================================
echo.
echo You can now launch QuestForge by running:
echo     run.bat
echo.
pause
