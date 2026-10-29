@echo off
rem Arranca la web en local y abre el navegador. Doble clic para usar.
rem Usa Node si existe; si no, Python.
cd /d "%~dp0\.."
set PORT=8080

where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  node LocalTest\serve.mjs %PORT%
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  py LocalTest\serve.py %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%/"
  python LocalTest\serve.py %PORT%
  goto :eof
)

echo No se ha encontrado Node.js ni Python. Instala uno de los dos.
pause
