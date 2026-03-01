@echo off
setlocal enabledelayedexpansion

set OWNER=thomas-iniguez-visioli
set REPO=youtube-public

:: Récupère la liste des releases
for /f "delims=" %%a in ('gh api repos/%OWNER%/%REPO%/releases ^| jq -r ".[] | select(.draft == true) | .id"') do (
    set ID=%%a
    echo Suppression de la draft release ID: !ID!
    gh api repos/%OWNER%/%REPO%/releases/!ID! -X DELETE
)

pause
