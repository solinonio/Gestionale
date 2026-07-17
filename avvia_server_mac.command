#!/bin/bash
clear
# Ottieni la cartella in cui si trova lo script
cd "$(dirname "$0")"

echo "==================================================="
echo "   AVVIO SERVER GESTIONALE PREVENTIVI (macOS)"
echo "==================================================="
echo ""

# Verifica se Node.js è installato
if ! command -v node &> /dev/null
then
    echo "[ERRORE] Node.js non è installato!"
    echo "Per favore, scarica e installa Node.js (versione LTS) da https://nodejs.org/"
    echo "Al termine dell'installazione, riapri questo file."
    echo ""
    read -p "Premi [Invio] per uscire..."
    exit 1
fi

echo "[1/3] Verifica e installazione delle dipendenze..."
npm install

echo ""
echo "[2/3] Compilazione dell'applicazione..."
npm run build

echo ""
echo "[3/3] Avvio del server in corso..."

# Verifica e libera la porta 3000 e 24678 se occupate da processi precedenti
echo "Verifica e liberazione porte..."
PID_3000=$(lsof -t -i:3000)
if [ ! -z "$PID_3000" ]; then
    echo "-> Liberazione porta 3000 (processo $PID_3000)..."
    kill -9 $PID_3000 2>/dev/null
fi

PID_24678=$(lsof -t -i:24678)
if [ ! -z "$PID_24678" ]; then
    echo "-> Liberazione porta 24678 (processo $PID_24678)..."
    kill -9 $PID_24678 2>/dev/null
fi

echo "L'applicazione sarà accessibile dai computer della rete."
echo ""
echo "---------------------------------------------------"
echo "  PER ACCEDERE AL PROGRAMMA:"
echo ""
echo "  1. Da QUESTO Mac: apri il browser su http://localhost:3000"
echo "  2. Da ALTRI computer (PC/Mac) nella stessa rete:"
echo "     Trova l'indirizzo IP di questo Mac (es. 192.168.1.150)"
echo "     e apri il browser su http://IP_DEL_MAC:3000"
echo "---------------------------------------------------"
echo ""
echo "Per fermare il server, premi CTRL+C in questa finestra."
echo ""

npm run start
