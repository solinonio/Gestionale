const { app, BrowserWindow, dialog, shell } = require('electron');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

// Configurazione API Locale
const API_PORT = 4500;
const server = express();
server.use(cors());
server.use(bodyParser.json());

// --- ENDPOINT API ---

// 1. Selezione File PDF
server.get('/select-file', async (req, res) => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Documenti PDF', extensions: ['pdf'] }]
        });

        if (result.canceled) {
            return res.json({ canceled: true });
        }

        const filePath = result.filePaths[0];
        const fileName = path.basename(filePath);
        
        res.json({
            canceled: false,
            path: filePath,
            name: fileName,
            size: fs.statSync(filePath).size
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Copia File su NAS
server.post('/copy-to-nas', async (req, res) => {
    const { sourcePath, nasDirectory } = req.body;
    
    try {
        if (!fs.existsSync(nasDirectory)) {
            // Se la directory NAS non esiste, proviamo a crearla (richiede permessi)
            await fs.ensureDir(nasDirectory);
        }

        const fileName = path.basename(sourcePath);
        const destinationPath = path.join(nasDirectory, fileName);

        await fs.copy(sourcePath, destinationPath);

        res.json({
            success: true,
            destinationPath: destinationPath,
            fileName: fileName
        });
    } catch (err) {
        res.status(500).json({ error: `Impossibile copiare sul NAS: ${err.message}. Verifica i permessi della cartella condivisa.` });
    }
});

// 3. Apri File con Programma Predefinito
server.post('/open-file', async (req, res) => {
    const { filePath } = req.body;
    try {
        if (fs.existsSync(filePath)) {
            await shell.openPath(filePath);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'File non trovato nel percorso specificato' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Avvio Server Express
server.listen(API_PORT, () => {
    console.log(`Bridge API in ascolto su http://localhost:${API_PORT}`);
});

// --- LOGICA ELECTRON ---

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 300,
        title: "Gestionale Bridge",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true
        }
    });

    // Pagina di stato semplice
    mainWindow.loadURL(`data:text/html,
        <html>
            <body style="font-family:sans-serif; text-align:center; padding-top:50px; background:#f0f4f8;">
                <h2 style="color:#2d3748;">Bridge Attivo</h2>
                <p style="color:#4a5568;">In ascolto sulla porta <b>${API_PORT}</b></p>
                <div style="margin-top:20px; color:#718096; font-size:12px;">
                    Questa finestra deve rimanere aperta per <br> gestire gli allegati sul NAS.
                </div>
            </body>
        </html>
    `);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Avvio automatico (opzionale, configurabile via installer)
app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe')
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
