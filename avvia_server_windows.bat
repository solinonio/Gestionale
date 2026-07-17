@echo off
title Avvio Server Gestionale Preventivi
echo ===================================================
echo   AVVIO SERVER GESTIONALE PREVENTIVI (WINDOWS)
echo ===================================================
echo.

:: Verifica se Node.js è installato
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRORE] Node.js non e' installato!
    echo Per favore, scarica e installa Node.js da https://nodejs.org/
    echo Al termine dell'installazione, riavvia questo file.
    echo.
    pause
    exit
)

echo [1/3] Verifica e installazione delle dipendenze...
call npm install

echo.
echo [2/3] Compilazione dell'applicazione...
call npm run build

echo.
echo [3/3] Avvio del server in corso...
echo L'applicazione sara' accessibile dai computer della rete.
echo.
echo ---------------------------------------------------
echo   PER ACCEDERE AL PROGRAMMA:
echo.
echo   1. Da QUESTO computer: apri il browser su http://localhost:3000
echo   2. Da ALTRI computer (PC/Mac) nella stessa rete:
echo      Trova l'indirizzo IP di questo computer (es. 192.168.1.150)
echo      e apri il browser su http://IP_DEL_TUO_PC:3000
echo ---------------------------------------------------
echo.
echo Per fermare il server, premi CTRL+C in questa finestra.
echo.

npm run start
pause
