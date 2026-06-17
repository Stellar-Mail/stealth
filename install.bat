@echo off
rem Add bundled node to PATH
set "PATH=c:\Users\HP\stealth\.node\node-v22.13.0-win-x64;%PATH%"
rem Run npm install with required flags
"c:\Users\HP\stealth\.node\node-v22.13.0-win-x64\npm.cmd" install --legacy-peer-deps --force --unsafe-perm
if %ERRORLEVEL% neq 0 (
  echo npm install failed with exit code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)
echo npm install completed successfully
