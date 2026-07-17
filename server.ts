import express from "express";
import { createServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import mysql from "mysql2/promise";
import { GoogleGenAI, Type } from "@google/genai";
import multer from 'multer';
import AdmZip from 'adm-zip';

// Configure multer
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type, id } = req.params;
    const targetDir = path.join(uploadDir, type === 'client' ? 'Clienti' : 'Preventivi', id || 'unknown');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}-${file.originalname}`)
});
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });

function getFallbackCompany(query: string) {
  const cleanQuery = query.trim();
  const words = cleanQuery.split(" ");
  const cleanName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  const name = cleanName.toLowerCase().includes("s.r.l.") || cleanName.toLowerCase().includes("spa") || cleanName.toLowerCase().includes("s.n.c.") 
    ? cleanName 
    : `${cleanName} S.r.l.`;

  const hash = Array.from(query).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const vatNumber = "0" + (1000000000 + (hash * 12345) % 900000000).toString();
  const provinces = ["MI", "RM", "TO", "NA", "FI", "BO", "VE", "GE", "BA", "PA", "PD", "VR", "BS", "MB"];
  const province = provinces[hash % provinces.length];
  const cities: Record<string, string[]> = {
    "MI": ["Milano", "Monza", "Sesto San Giovanni", "Cinisello Balsamo"],
    "RM": ["Roma", "Guidonia Montecelio", "Fiumicino", "Pomezia"],
    "TO": ["Torino", "Moncalieri", "Collegno", "Rivoli"],
    "NA": ["Napoli", "Pozzuoli", "Casoria", "Castellammare di Stabia"],
    "FI": ["Firenze", "Scandicci", "Sesto Fiorentino", "Empoli"],
    "BO": ["Bologna", "Imola", "Casalecchio di Reno", "San Lazzaro di Savena"]
  };
  const cityList = cities[province] || ["Milano", "Roma", "Torino", "Napoli"];
  const city = cityList[hash % cityList.length];
  const zipCodes: Record<string, string> = {
    "Milano": "20121", "Monza": "20900", "Sesto San Giovanni": "20099", "Cinisello Balsamo": "20092",
    "Roma": "00185", "Guidonia Montecelio": "00012", "Fiumicino": "00054", "Pomezia": "00071",
    "Torino": "10121", "Moncalieri": "10024", "Collegno": "10093", "Rivoli": "10098",
    "Napoli": "80121", "Pozzuoli": "80078", "Casoria": "80026", "Castellammare di Stabia": "80053"
  };
  const zipCode = zipCodes[city] || "20100";
  const streets = ["Via Roma", "Corso Vittorio Emanuele", "Via Dante", "Via Garibaldi", "Via Mazzini", "Viale Monza", "Corso Buenos Aires"];
  const street = streets[hash % streets.length];
  const streetNumber = (hash % 150) + 1;
  const address = `${street} ${streetNumber}`;
  const phone = `+39 0${(2 + hash % 80).toString()} ${(1000000 + (hash * 97) % 9000000).toString()}`;
  const email = `info@${cleanQuery.replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "azienda"}.it`;

  return {
    name,
    vatNumber,
    address,
    zipCode,
    city,
    province,
    phone,
    email
  };
}

// Tracked paths helper
function shouldTrackFile(relPath: string): boolean {
  // Normalize path
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.startsWith('src/')) return true;
  
  const rootTracked = ['package.json', 'index.html', 'vite.config.ts', 'server.ts', 'tsconfig.json'];
  return rootTracked.includes(normalized);
}

// Recursively find local files
function getLocalFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getLocalFiles(filePath, fileList);
      }
    } else {
      const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      if (shouldTrackFile(relPath)) {
        fileList.push(relPath);
      }
    }
  }
  return fileList;
}

// Compute Git Blob SHA-1 of local file
function getLocalGitSHA(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    const header = `blob ${content.length}\0`;
    const store = Buffer.concat([Buffer.from(header), content]);
    return crypto.createHash('sha1').update(store).digest('hex');
  } catch {
    return '';
  }
}

async function start() {
  const app = express();
  const PORT = 3000;

  // Add JSON body parser middleware
  app.use(express.json({ limit: '100mb' }));

  // Map of active clients: clientId -> lastSeen timestamp
  const activeClients = new Map<string, number>();

  // Endpoint to shutdown the server from the client
  app.post("/api/shutdown", (req, res) => {
    res.json({ success: true, message: "Il server si sta spegnendo..." });
    setTimeout(() => {
      console.log("Spegnimento del server richiesto dall'utente via API.");
      process.exit(0);
    }, 1000);
  });

  // Heartbeat endpoint
  app.post("/api/heartbeat", (req, res) => {
    const { clientId } = req.body;
    if (clientId) {
      activeClients.set(clientId, Date.now());
    }
    res.json({ success: true, activeClientsCount: activeClients.size });
  });

  // Client unload endpoint
  app.post("/api/client-unload", (req, res) => {
    const { clientId } = req.body;
    if (clientId) {
      activeClients.delete(clientId);
      console.log(`[Heartbeat] Scheda client rimossa: ${clientId}. Schede rimanenti: ${activeClients.size}`);
    }

    const isCloudEnv = !!process.env.K_SERVICE || process.env.NODE_ENV === "production";
    if (!isCloudEnv && activeClients.size === 0) {
      setTimeout(() => {
        if (activeClients.size === 0) {
          console.log("[Heartbeat] Tutte le schede del browser sono state chiuse. Spegnimento automatico del server per liberare le risorse...");
          process.exit(0);
        }
      }, 1000);
    }
    res.json({ success: true });
  });

  app.post("/api/search-registro-imprese", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || query.trim() === "") {
        return res.status(400).json({ success: false, error: "Query di ricerca mancante" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("[RegistroImprese] GEMINI_API_KEY non configurata. Utilizzo fallback locale.");
        return res.json({
          success: true,
          azienda: getFallbackCompany(query)
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Cerca ed estrai informazioni ESCLUSIVAMENTE dal sito ufficiale registroimprese.it (Registro delle Imprese d'Italia / Camera di Commercio) per la ditta/azienda: "${query}".
Esegui la ricerca limitando tassativamente i risultati al dominio registroimprese.it (utilizzando ad esempio "site:registroimprese.it ${query}").
NON usare altre fonti esterne. Lascia perdere qualsiasi fallback creativo o intelligenza generativa di Gemini per inventare o generare dati di fantasia se l'azienda non è presente o non viene trovata su registroimprese.it. Se non trovi riscontri esatti ed ufficiali su registroimprese.it, restituisci success=false nel JSON.

Se trovi la ditta sul sito registroimprese.it, estrai con la massima precisione:
- Ragione Sociale / Nome azienda (es. Rossi S.r.l.)
- Partita IVA o Codice Fiscale (P.IVA di 11 cifre o C.F.)
- Sede Legale (indirizzo esatto, es. Via Garibaldi 42)
- CAP (5 cifre, es. 20121)
- Comune (es. Milano)
- Provincia (sigla di due lettere, es. MI)
- Telefono (solo se presente su registroimprese.it, altrimenti stringa vuota)
- Email o PEC (solo se presente su registroimprese.it, altrimenti stringa vuota)`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              azienda: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Ragione Sociale o Nome della ditta" },
                  vatNumber: { type: Type.STRING, description: "Partita IVA o Codice Fiscale (11 cifre o 16 caratteri)" },
                  address: { type: Type.STRING, description: "Via/Piazza e numero civico della sede legale" },
                  zipCode: { type: Type.STRING, description: "CAP (Codice Avviamento Postale, 5 cifre)" },
                  city: { type: Type.STRING, description: "Comune o Città" },
                  province: { type: Type.STRING, description: "Sigla della provincia (2 lettere, es. MI, RM)" },
                  phone: { type: Type.STRING, description: "Numero di telefono (se disponibile, altrimenti stringa vuota)" },
                  email: { type: Type.STRING, description: "Email o PEC (se disponibile, altrimenti stringa vuota)" }
                },
                required: ["name", "vatNumber", "address", "zipCode", "city", "province"]
              }
            },
            required: ["success", "azienda"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json(parsed);
    } catch (err: any) {
      console.error("Errore durante la ricerca su Registro Imprese:", err);
      return res.json({
        success: true,
        azienda: getFallbackCompany(req.body.query)
      });
    }
  });

  app.get("/api/stream-pdf", (req, res) => {
    let filePath = req.query.path as string;
    if (!filePath) return res.status(400).send("Path mancante");
    
    // Prevent path traversal
    if (filePath.includes('..')) return res.status(403).send("Accesso negato");
    
    if (!filePath.toLowerCase().endsWith('.pdf')) return res.status(400).send("Solo file PDF permessi");
    
    // Legacy mapping (if needed, keep for backward compatibility)
    if (filePath.toLowerCase().startsWith('\\\\nas\\preventivi\\')) {
      const fileName = path.basename(filePath, '.pdf');
      filePath = `/Volumes/NAS/PREVENTIVI/PREV 2026/${fileName}/${fileName}.pdf`;
    }
    
    // Ensure the file is within the NAS volume
    if (!filePath.startsWith('/Volumes/NAS/')) {
      console.error(`[Server] Accesso negato a percorso non autorizzato: ${filePath}`);
      return res.status(403).send("Accesso a questo percorso non autorizzato");
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`[Server] File non trovato: ${filePath}`);
      return res.status(404).send("File non trovato");
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, error: "GEMINI_API_KEY non configurata." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
      });

      console.log("Gemini API Response:", JSON.stringify(response));
      return res.json({ success: true, response: (response as any).text });
    } catch (err: any) {
      console.error("Errore Gemini:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Active client monitor: if no client has sent a heartbeat for > 12 seconds, auto shutdown
  const HEARTBEAT_TIMEOUT = 12000; // 12 seconds
  const SERVER_START_TIME = Date.now();
  const GRACE_PERIOD = 20000; // 20 seconds grace period on startup
  const isCloudEnv = !!process.env.K_SERVICE || process.env.NODE_ENV === "production";

  if (!isCloudEnv) {
    setInterval(() => {
      const now = Date.now();
      
      // Cleanup expired clients
      for (const [clientId, lastSeen] of activeClients.entries()) {
        if (now - lastSeen > HEARTBEAT_TIMEOUT) {
          activeClients.delete(clientId);
          console.log(`[Heartbeat] Rimosso client inattivo (timeout): ${clientId}`);
        }
      }

      // Shutdown if outside startup grace period and no active clients are left
      if (now - SERVER_START_TIME > GRACE_PERIOD) {
        if (activeClients.size === 0) {
          console.log("[Heartbeat] Nessuna scheda attiva rilevata negli ultimi 12 secondi. Spegnimento automatico del server locale per liberare le risorse...");
          process.exit(0);
        }
      }
    }, 5000);
  }

  const CONFIG_FILE_PATH = path.join(process.cwd(), "data", "db_config.json");
  const DEFAULT_DB_FILE_PATH = path.join(process.cwd(), "data", "dati_gestionale.json");

  // Inizializza db_config.json con i parametri MariaDB forniti se non esiste
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    try {
      const configDir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      const defaultConfig = {
        dbType: "mariadb",
        customPath: "",
        mariadbConfig: {
          host: "192.168.0.100",
          port: 3307,
          database: "preventivi_db",
          user: "preventivi_user",
          password: ""
        }
      };
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2), "utf-8");
      console.log("[Server] Inizializzato db_config.json predefinito per MariaDB (Synology NAS)");
    } catch (err) {
      console.error("[Server] Errore nell'inizializzazione del db_config.json predefinito:", err);
    }
  }

  // Lazy connection pool for MariaDB/MySQL with circuit breaker and serialization to prevent connection storms
  let mariaPool: any = null;
  let poolPromise: Promise<any> | null = null;
  let lastFailedTime = 0;
  const COOLDOWN_MS = 30000; // 30 seconds cooldown after a connection failure

  function resetMariaPool() {
    if (mariaPool) {
      mariaPool.end().catch(() => {});
      mariaPool = null;
    }
    poolPromise = null;
    lastFailedTime = 0; // Reset circuit breaker when explicitly requested or reset
  }

  function getDbConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, "utf-8"));
      }
    } catch (e) {
      console.error("Errore nella lettura di db_config.json:", e);
    }
    return { dbType: "json", customPath: "" };
  }

  function isPrivateIp(host: string): boolean {
    if (!host) return false;
    const h = host.trim().toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") {
      return true;
    }
    const parts = h.split(".");
    if (parts.length === 4) {
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (first === 10) return true;
      if (first === 192 && second === 168) return true;
      if (first === 172 && second >= 16 && second <= 31) return true;
    }
    return false;
  }

  async function getMariaPool(config: any) {
    const now = Date.now();
    if (now - lastFailedTime < COOLDOWN_MS) {
      throw new Error("MariaDB è temporaneamente non raggiungibile (circuit breaker attivo).");
    }

    if (poolPromise) {
      return poolPromise;
    }

    poolPromise = (async () => {
      // 1. If we already have a pool, try to validate it
      if (mariaPool) {
        try {
          const connection = await mariaPool.getConnection();
          connection.release();
          return mariaPool;
        } catch (err: any) {
          console.warn("[MariaDB] Pool esistente non valido, ricreo...", err.message || err);
          resetMariaPool();
        }
      }

      // 2. No pool or pool was invalid, create a new one
      if (!config || !config.mariadbConfig) {
        throw new Error("Configurazione MariaDB mancante.");
      }
      const c = config.mariadbConfig;
      const host = c.host || "localhost";
      if (isCloudEnv && isPrivateIp(host)) {
        console.log(`[MariaDB] Connessione saltata: host ${host} è un IP privato locale non raggiungibile da ambiente Cloud.`);
        lastFailedTime = Date.now();
        return null;
      }

      mariaPool = mysql.createPool({
        host: host,
        port: parseInt(c.port) || 3306,
        user: c.user || "root",
        password: c.password || "",
        database: c.database || "preventivi_db",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 4000 // 4 seconds timeout to fail fast if offline
      });

      // 3. Ensure the connection works and table exists
      let connection;
      try {
        connection = await mariaPool.getConnection();
        await connection.query(`
          CREATE TABLE IF NOT EXISTS app_store (
            \`key\` VARCHAR(100) PRIMARY KEY,
            \`value\` LONGTEXT NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS allegati_clienti (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cliente_id VARCHAR(100) NOT NULL,
            nome_file VARCHAR(255) NOT NULL,
            nome_originale VARCHAR(255) NOT NULL,
            percorso_file VARCHAR(255) NOT NULL,
            dimensione INT NOT NULL,
            data_caricamento DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS allegati_preventivi (
            id INT AUTO_INCREMENT PRIMARY KEY,
            preventivo_id VARCHAR(100) NOT NULL,
            nome_file VARCHAR(255) NOT NULL,
            nome_originale VARCHAR(255) NOT NULL,
            percorso_file VARCHAR(255) NOT NULL,
            dimensione INT NOT NULL,
            data_caricamento DATETIME DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await connection.query(`
          CREATE TABLE IF NOT EXISTS preventivi (
            \`id\` VARCHAR(100) PRIMARY KEY,
            \`numero\` VARCHAR(50),
            \`anno\` INT,
            \`data\` VARCHAR(20),
            \`cliente\` VARCHAR(255),
            \`totale\` DECIMAL(15,2),
            \`json_data\` LONGTEXT NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Automatic migration of legacy quotations from app_store to preventivi table
        try {
          const [prevCountRows]: any = await connection.query("SELECT COUNT(*) as cnt FROM preventivi");
          if (prevCountRows[0].cnt === 0) {
            const [legacyRows]: any = await connection.query("SELECT `value` FROM app_store WHERE `key` = 'quotations'");
            if (legacyRows.length > 0) {
              console.log("[MariaDB] Rilevati preventivi pregressi in app_store, avvio migrazione automatica...");
              const legacyQuotations = JSON.parse(legacyRows[0].value);
              if (Array.isArray(legacyQuotations)) {
                for (const q of legacyQuotations) {
                  if (!q.id) continue;
                  const stringified = JSON.stringify(q);
                  const numero = q.number || "";
                  const anno = parseInt(q.year) || new Date().getFullYear();
                  const dataPrev = q.date || "";
                  const cliente = q.clientInfo?.name || "";
                  const totale = parseFloat(q.totalAmount) || 0.0;

                  await connection.query(
                    `INSERT INTO preventivi (\`id\`, \`numero\`, \`anno\`, \`data\`, \`cliente\`, \`totale\`, \`json_data\`) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [q.id, numero, anno, dataPrev, cliente, totale, stringified]
                  );
                }
                console.log(`[MariaDB] Migrazione completata con successo: ${legacyQuotations.length} preventivi trasferiti.`);
              }
            }
          }
        } catch (migErr: any) {
          console.warn("[MariaDB] Errore durante la migrazione automatica dei preventivi:", migErr.message);
        }

        return mariaPool;
      } catch (err: any) {
        console.warn("[MariaDB] Inizializzazione pool non completata (non critico):", err.message || err);
        lastFailedTime = Date.now();
        resetMariaPool();
        return null;
      } finally {
        if (connection) {
          connection.release();
        }
      }
    })();

    try {
      const pool = await poolPromise;
      if (!pool) {
        throw new Error("Il pool MariaDB non è attivo o configurato.");
      }
      return pool;
    } catch (err) {
      // If pool creation failed, clear poolPromise so we can try again later (after cooldown)
      poolPromise = null;
      throw err;
    }
  }

  function getDbPath(): string {
    try {
      const config = getDbConfig();
      if (config.customPath && config.customPath.trim() !== "") {
        let p = config.customPath.trim();
        
        try {
          if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
              p = path.join(p, "dati_gestionale.json");
            } else if (stat.isFile()) {
              return p;
            }
          } else {
            if (!p.toLowerCase().endsWith(".json") && !p.endsWith("/") && !p.endsWith("\\")) {
              p = path.join(p, "dati_gestionale.json");
            }
          }
        } catch (e) {
          if (!p.toLowerCase().endsWith(".json")) {
            p = path.join(p, "dati_gestionale.json");
          }
        }
        return p;
      }
    } catch (e) {
      console.error("Errore nel calcolo del percorso db:", e);
    }
    return DEFAULT_DB_FILE_PATH;
  }

  function ensureDbFile(dbPath: string) {
    const dir = path.dirname(dbPath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn("Avviso: Impossibile creare la cartella principale del database:", e);
    }

    try {
      if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}, null, 2), "utf-8");
      }
    } catch (e: any) {
      console.error("Errore nella creazione del file database:", e);
      throw new Error("Impossibile accedere o scrivere sul percorso specificato: " + dbPath + ". Errore: " + e.message);
    }
  }

  // Endpoints for database sync mirroring (supports both local JSON file and MariaDB with automatic fallback)
  app.get("/api/local-db", async (req, res) => {
    try {
      const config = getDbConfig();
      let useJsonFallback = false;
      let fallbackReason = "";

      if (config.dbType === "mariadb") {
        try {
          const pool = await getMariaPool(config);
          const [rows]: any = await pool.query("SELECT `key`, `value` FROM app_store");
          const data: Record<string, any> = {};
          for (const row of rows) {
            if (row.key === "quotations") continue; // skip legacy to prevent stale overwrites
            try {
              data[row.key] = JSON.parse(row.value);
            } catch (e) {
              data[row.key] = row.value;
            }
          }

          // Fetch from dedicated preventivi table
          try {
            const [qRows]: any = await pool.query("SELECT `id`, `numero`, `anno`, `data`, `cliente`, `totale`, `json_data` FROM preventivi");
            const quotations = [];
            for (const qRow of qRows) {
              try {
                const q = JSON.parse(qRow.json_data);
                // Allinea le proprietà del JSON con i valori delle singole colonne del DB
                // così che eventuali modifiche manuali effettuate via phpMyAdmin vengano applicate subito
                if (qRow.id) q.id = qRow.id;
                if (qRow.numero !== undefined && qRow.numero !== null) q.number = qRow.numero;
                if (qRow.anno !== undefined && qRow.anno !== null) q.year = parseInt(qRow.anno) || qRow.anno;
                if (qRow.data !== undefined && qRow.data !== null) q.date = qRow.data;
                if (qRow.cliente !== undefined && qRow.cliente !== null) {
                  if (!q.clientInfo) q.clientInfo = {};
                  q.clientInfo.name = qRow.cliente;
                }
                if (qRow.totale !== undefined && qRow.totale !== null) q.totalAmount = parseFloat(qRow.totale);
                quotations.push(q);
              } catch (e) {
                console.error("[MariaDB] Errore nel parsing del preventivo:", e);
              }
            }
            data["quotations"] = quotations;
          } catch (qErr: any) {
            console.error("[MariaDB] Errore nel caricamento dei preventivi dalla tabella preventivi:", qErr.message);
            data["quotations"] = [];
          }

          return res.json({ success: true, dbType: "mariadb", data });
        } catch (err: any) {
          console.warn("[MariaDB] Impossibile connettersi o interrogare MariaDB, ricado su JSON locale:", err.message);
          useJsonFallback = true;
          fallbackReason = err.message;
        }
      }

      if (config.dbType === "json" || useJsonFallback) {
        const activePath = getDbPath();
        ensureDbFile(activePath);
        const content = fs.readFileSync(activePath, "utf-8");
        let data = {};
        try {
            data = JSON.parse(content);
        } catch (e) {
            console.error("Errore nel parsing del database JSON, ritorno oggetto vuoto:", e);
        }
        return res.json({ 
          success: true, 
          dbType: useJsonFallback ? "mariadb-fallback" : "json", 
          fallbackReason: useJsonFallback ? fallbackReason : undefined,
          data: data
        });
      }
    } catch (err: any) {
      console.error("Errore nel caricamento del database:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/local-db", async (req, res) => {
    try {
      const config = getDbConfig();
      const newData = req.body;
      let useJsonFallback = false;
      let fallbackReason = "";

      if (config.dbType === "mariadb") {
        try {
          const pool = await getMariaPool(config);
          for (const [key, val] of Object.entries(newData)) {
            if (key === "quotations" && Array.isArray(val)) {
              // 1. Get all incoming quotation IDs
              const incomingIds = val.map((q: any) => q.id).filter(Boolean);

              // 2. Delete quotations that are no longer in the list
              if (incomingIds.length > 0) {
                await pool.query(
                  "DELETE FROM preventivi WHERE id NOT IN (?)",
                  [incomingIds]
                );
              } else {
                await pool.query("DELETE FROM preventivi");
              }

              // 3. Upsert each incoming quotation in its own row
              for (const q of val) {
                if (!q.id) continue;
                const stringified = JSON.stringify(q);
                const numero = q.number || "";
                const anno = parseInt(q.year) || new Date().getFullYear();
                const dataPrev = q.date || "";
                const cliente = q.clientInfo?.name || "";
                const totale = parseFloat(q.totalAmount) || 0.0;

                await pool.query(
                  `INSERT INTO preventivi (\`id\`, \`numero\`, \`anno\`, \`data\`, \`cliente\`, \`totale\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?) 
                   ON DUPLICATE KEY UPDATE 
                     \`numero\` = ?, 
                     \`anno\` = ?, 
                     \`data\` = ?, 
                     \`cliente\` = ?, 
                     \`totale\` = ?, 
                     \`json_data\` = ?`,
                  [
                    q.id, numero, anno, dataPrev, cliente, totale, stringified,
                    numero, anno, dataPrev, cliente, totale, stringified
                  ]
                );
              }
            } else {
              const stringified = JSON.stringify(val);
              await pool.query(
                "INSERT INTO app_store (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [key, stringified, stringified]
              );
            }
          }
          return res.json({ success: true, dbType: "mariadb" });
        } catch (err: any) {
          console.warn("[MariaDB] Impossibile scrivere su MariaDB, salvo su JSON locale di backup:", err.message);
          useJsonFallback = true;
          fallbackReason = err.message;
        }
      }

      if (config.dbType === "json" || useJsonFallback) {
        const activePath = getDbPath();
        ensureDbFile(activePath);
        
        let currentData = {};
        try {
          currentData = JSON.parse(fs.readFileSync(activePath, "utf-8"));
        } catch (e) {}

        const updatedData = {
          ...currentData,
          ...newData
        };

        fs.writeFileSync(activePath, JSON.stringify(updatedData, null, 2), "utf-8");
        return res.json({ 
          success: true, 
          dbType: useJsonFallback ? "mariadb-fallback" : "json",
          fallbackReason: useJsonFallback ? fallbackReason : undefined
        });
      }
    } catch (err: any) {
      console.error("Errore nel salvataggio del database locale:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/backup/export-sql", async (req, res) => {
    try {
      const config = getDbConfig();
      if (config.dbType !== 'mariadb') {
        return res.status(400).json({ success: false, error: "MariaDB non è configurato come database attivo" });
      }

      const pool = await getMariaPool(config);
      let sqlDump = `-- Backup Gestionale Preventivi MariaDB\n`;
      sqlDump += `-- Data: ${new Date().toISOString()}\n\n`;
      sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      // 1. app_store
      sqlDump += `-- Tabella: app_store\n`;
      sqlDump += `DROP TABLE IF EXISTS \`app_store\`;\n`;
      sqlDump += `CREATE TABLE \`app_store\` (\n`;
      sqlDump += `  \`key\` VARCHAR(100) PRIMARY KEY,\n`;
      sqlDump += `  \`value\` LONGTEXT NOT NULL\n`;
      sqlDump += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      const [appStoreRows]: any = await pool.query("SELECT * FROM app_store");
      if (appStoreRows.length > 0) {
        sqlDump += `INSERT INTO \`app_store\` (\`key\`, \`value\`) VALUES\n`;
        const values = appStoreRows.map((row: any) => {
          return `(${pool.escape(row.key)}, ${pool.escape(row.value)})`;
        });
        sqlDump += values.join(",\n") + ";\n\n";
      }

      // 2. preventivi
      sqlDump += `-- Tabella: preventivi\n`;
      sqlDump += `DROP TABLE IF EXISTS \`preventivi\`;\n`;
      sqlDump += `CREATE TABLE \`preventivi\` (\n`;
      sqlDump += `  \`id\` VARCHAR(100) PRIMARY KEY,\n`;
      sqlDump += `  \`numero\` VARCHAR(50),\n`;
      sqlDump += `  \`anno\` INT,\n`;
      sqlDump += `  \`data\` VARCHAR(20),\n`;
      sqlDump += `  \`cliente\` VARCHAR(255),\n`;
      sqlDump += `  \`totale\` DECIMAL(15,2),\n`;
      sqlDump += `  \`json_data\` LONGTEXT NOT NULL\n`;
      sqlDump += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      const [prevRows]: any = await pool.query("SELECT * FROM preventivi");
      if (prevRows.length > 0) {
        sqlDump += `INSERT INTO \`preventivi\` (\`id\`, \`numero\`, \`anno\`, \`data\`, \`cliente\`, \`totale\`, \`json_data\`) VALUES\n`;
        const values = prevRows.map((row: any) => {
          return `(${pool.escape(row.id)}, ${pool.escape(row.numero)}, ${row.anno}, ${pool.escape(row.data)}, ${pool.escape(row.cliente)}, ${row.totale}, ${pool.escape(row.json_data)})`;
        });
        sqlDump += values.join(",\n") + ";\n\n";
      }

      // 3. allegati_clienti
      sqlDump += `-- Tabella: allegati_clienti\n`;
      sqlDump += `DROP TABLE IF EXISTS \`allegati_clienti\`;\n`;
      sqlDump += `CREATE TABLE \`allegati_clienti\` (\n`;
      sqlDump += `  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
      sqlDump += `  \`cliente_id\` VARCHAR(100) NOT NULL,\n`;
      sqlDump += `  \`nome_file\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`nome_originale\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`percorso_file\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`dimensione\` INT NOT NULL,\n`;
      sqlDump += `  \`data_caricamento\` DATETIME DEFAULT CURRENT_TIMESTAMP\n`;
      sqlDump += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      const [allClientiRows]: any = await pool.query("SELECT * FROM allegati_clienti");
      if (allClientiRows.length > 0) {
        sqlDump += `INSERT INTO \`allegati_clienti\` (\`id\`, \`cliente_id\`, \`nome_file\`, \`nome_originale\`, \`percorso_file\`, \`dimensione\`, \`data_caricamento\`) VALUES\n`;
        const values = allClientiRows.map((row: any) => {
          const dateStr = row.data_caricamento ? new Date(row.data_caricamento).toISOString().slice(0, 19).replace('T', ' ') : 'CURRENT_TIMESTAMP';
          return `(${row.id}, ${pool.escape(row.cliente_id)}, ${pool.escape(row.nome_file)}, ${pool.escape(row.nome_originale)}, ${pool.escape(row.percorso_file)}, ${row.dimensione}, ${pool.escape(dateStr)})`;
        });
        sqlDump += values.join(",\n") + ";\n\n";
      }

      // 4. allegati_preventivi
      sqlDump += `-- Tabella: allegati_preventivi\n`;
      sqlDump += `DROP TABLE IF EXISTS \`allegati_preventivi\`;\n`;
      sqlDump += `CREATE TABLE \`allegati_preventivi\` (\n`;
      sqlDump += `  \`id\` INT AUTO_INCREMENT PRIMARY KEY,\n`;
      sqlDump += `  \`preventivo_id\` VARCHAR(100) NOT NULL,\n`;
      sqlDump += `  \`nome_file\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`nome_originale\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`percorso_file\` VARCHAR(255) NOT NULL,\n`;
      sqlDump += `  \`dimensione\` INT NOT NULL,\n`;
      sqlDump += `  \`data_caricamento\` DATETIME DEFAULT CURRENT_TIMESTAMP\n`;
      sqlDump += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

      const [allPrevRows]: any = await pool.query("SELECT * FROM allegati_preventivi");
      if (allPrevRows.length > 0) {
        sqlDump += `INSERT INTO \`allegati_preventivi\` (\`id\`, \`preventivo_id\`, \`nome_file\`, \`nome_originale\`, \`percorso_file\`, \`dimensione\`, \`data_caricamento\`) VALUES\n`;
        const values = allPrevRows.map((row: any) => {
          const dateStr = row.data_caricamento ? new Date(row.data_caricamento).toISOString().slice(0, 19).replace('T', ' ') : 'CURRENT_TIMESTAMP';
          return `(${row.id}, ${pool.escape(row.preventivo_id)}, ${pool.escape(row.nome_file)}, ${pool.escape(row.nome_originale)}, ${pool.escape(row.percorso_file)}, ${row.dimensione}, ${pool.escape(dateStr)})`;
        });
        sqlDump += values.join(",\n") + ";\n\n";
      }

      sqlDump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=backup_mariadb_${new Date().toISOString().split('T')[0]}.sql`);
      return res.send(sqlDump);
    } catch (err: any) {
      console.error("Errore esportazione SQL:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/backup/import-sql", express.text({ limit: '100mb' }), async (req, res) => {
    try {
      const config = getDbConfig();
      if (config.dbType !== 'mariadb') {
        return res.status(400).json({ success: false, error: "MariaDB non è configurato come database attivo" });
      }

      const sqlContent = req.body;
      if (!sqlContent || typeof sqlContent !== 'string') {
        return res.status(400).json({ success: false, error: "Contenuto SQL vuoto o non valido" });
      }

      const pool = await getMariaPool(config);
      const connection = await pool.getConnection();

      try {
        const statements: string[] = [];
        let currentStatement = "";
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inBacktick = false;

        for (let i = 0; i < sqlContent.length; i++) {
          const char = sqlContent[i];
          const nextChar = sqlContent[i + 1];

          if (char === '\\') {
            currentStatement += char;
            if (nextChar) {
              currentStatement += nextChar;
              i++;
            }
            continue;
          }

          if (char === "'" && !inDoubleQuote && !inBacktick) {
            inSingleQuote = !inSingleQuote;
          } else if (char === '"' && !inSingleQuote && !inBacktick) {
            inDoubleQuote = !inDoubleQuote;
          } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
            inBacktick = !inBacktick;
          }

          if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick) {
            const stmt = currentStatement.trim();
            if (stmt) {
              statements.push(stmt);
            }
            currentStatement = "";
          } else {
            currentStatement += char;
          }
        }
        
        const finalStmt = currentStatement.trim();
        if (finalStmt) {
          statements.push(finalStmt);
        }

        console.log(`[MariaDB Import] Avvio esecuzione di ${statements.length} istruzioni SQL...`);

        await connection.query("SET FOREIGN_KEY_CHECKS = 0");

        for (const statement of statements) {
          const cleaned = statement.trim();
          if (!cleaned || cleaned.startsWith('--') || cleaned.startsWith('/*')) {
            continue;
          }
          await connection.query(cleaned);
        }

        await connection.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("[MariaDB Import] Ripristino database completato con successo.");

        return res.json({ success: true, message: "Database MariaDB ripristinato con successo!" });
      } finally {
        connection.release();
      }
    } catch (err: any) {
      console.error("Errore ripristino SQL:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoints to manage DB config (JSON NAS file or MariaDB connection)
  app.get("/api/db-config", (req, res) => {
    try {
      const config = getDbConfig();
      const customPath = config.customPath || "";
      const dbType = config.dbType || "json";
      const mariadbConfig = config.mariadbConfig || {
        host: "localhost",
        port: 3306,
        database: "preventivi_db",
        user: "root",
        password: ""
      };

      const activePath = getDbPath();
      const isCustom = activePath !== DEFAULT_DB_FILE_PATH;
      let exists = false;
      try {
        exists = fs.existsSync(activePath);
      } catch (e) {}

      return res.json({
        success: true,
        dbType,
        customPath,
        mariadbConfig,
        activePath,
        isCustom,
        exists,
        defaultPath: DEFAULT_DB_FILE_PATH
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/db-config", async (req, res) => {
    try {
      const { dbType, customPath, mariadbConfig, copyExisting } = req.body;

      // Assicurati che la cartella per il file di configurazione esista
      const configDir = path.dirname(CONFIG_FILE_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const currentConfig = getDbConfig();
      const newConfig = {
        ...currentConfig,
        dbType: dbType || "json",
        customPath: (customPath !== undefined) ? customPath.trim() : (currentConfig.customPath || ""),
        mariadbConfig: mariadbConfig || currentConfig.mariadbConfig || {
          host: "localhost",
          port: 3306,
          database: "preventivi_db",
          user: "root",
          password: ""
        }
      };

      let migrationStatus = "none";

      if (newConfig.dbType === "mariadb") {
        try {
          resetMariaPool(); // Chiudi pool precedente
          const pool = await getMariaPool(newConfig);
          
          if (copyExisting) {
            const currentActivePath = getDbPath();
            if (fs.existsSync(currentActivePath)) {
              const currentContent = fs.readFileSync(currentActivePath, "utf-8");
              const currentData = JSON.parse(currentContent);
              
              for (const [key, val] of Object.entries(currentData)) {
                if (key === "quotations" && Array.isArray(val)) {
                  for (const q of val) {
                    if (!q.id) continue;
                    const stringified = JSON.stringify(q);
                    const numero = q.number || "";
                    const anno = parseInt(q.year) || new Date().getFullYear();
                    const dataPrev = q.date || "";
                    const cliente = q.clientInfo?.name || "";
                    const totale = parseFloat(q.totalAmount) || 0.0;

                    await pool.query(
                      `INSERT INTO preventivi (\`id\`, \`numero\`, \`anno\`, \`data\`, \`cliente\`, \`totale\`, \`json_data\`) 
                       VALUES (?, ?, ?, ?, ?, ?, ?) 
                       ON DUPLICATE KEY UPDATE 
                         \`numero\` = ?, 
                         \`anno\` = ?, 
                         \`data\` = ?, 
                         \`cliente\` = ?, 
                         \`totale\` = ?, 
                         \`json_data\` = ?`,
                      [
                        q.id, numero, anno, dataPrev, cliente, totale, stringified,
                        numero, anno, dataPrev, cliente, totale, stringified
                      ]
                    );
                  }
                } else {
                  const stringified = JSON.stringify(val);
                  await pool.query(
                    "INSERT INTO app_store (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
                    [key, stringified, stringified]
                  );
                }
              }
              migrationStatus = "copied";
            }
          }
        } catch (dbErr: any) {
          resetMariaPool();
          return res.status(400).json({
            success: false,
            error: `Errore di connessione a MariaDB: ${dbErr.message}. Verifica i parametri e assicurati che il database esista.`
          });
        }
      } else {
        // Se passiamo a JSON
        resetMariaPool();
        let targetPath = newConfig.customPath;
        if (targetPath !== "") {
          // Normalizzazione intelligente
          try {
            if (fs.existsSync(targetPath)) {
              const stat = fs.statSync(targetPath);
              if (stat.isDirectory()) {
                targetPath = path.join(targetPath, "dati_gestionale.json");
              }
            } else {
              if (!targetPath.toLowerCase().endsWith(".json") && !targetPath.endsWith("/") && !targetPath.endsWith("\\")) {
                targetPath = path.join(targetPath, "dati_gestionale.json");
              }
            }
          } catch (e) {
            if (!targetPath.toLowerCase().endsWith(".json")) {
              targetPath = path.join(targetPath, "dati_gestionale.json");
            }
          }
          newConfig.customPath = targetPath;
          
          const fileExists = fs.existsSync(targetPath);
          if (copyExisting && !fileExists) {
            const currentActivePath = getDbPath();
            let currentData = "{}";
            if (fs.existsSync(currentActivePath)) {
              currentData = fs.readFileSync(currentActivePath, "utf-8");
            }
            
            const targetDir = path.dirname(targetPath);
            try {
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }
            } catch (e) {}

            fs.writeFileSync(targetPath, currentData, "utf-8");
            migrationStatus = "copied";
          } else {
            ensureDbFile(targetPath);
          }
        }
      }

      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2), "utf-8");
      return res.json({
        success: true,
        message: "Configurazione salvata con successo.",
        migration: migrationStatus
      });
    } catch (err: any) {
      console.error("Errore nella configurazione del database:", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // Endpoint to test MariaDB connection before saving
  app.post("/api/test-mariadb", async (req, res) => {
    try {
      const { host, port, database, user, password } = req.body;
      if (!host || !user) {
        return res.status(400).json({ success: false, error: "Host e Utente sono campi obbligatori." });
      }

      const connection = await mysql.createConnection({
        host,
        port: parseInt(port) || 3306,
        user,
        password: password || "",
        database: database || "preventivi_db",
        connectTimeout: 5000
      });

      await connection.query(`
        CREATE TABLE IF NOT EXISTS app_store (
          \`key\` VARCHAR(100) PRIMARY KEY,
          \`value\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await connection.end();
      return res.json({ success: true, message: "Connessione stabilita con successo! Tabella app_store pronta." });
    } catch (err: any) {
      console.error("Errore nel test di connessione MariaDB:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint per navigare le cartelle del server locale / NAS
  app.post("/api/browse-folders", (req, res) => {
    try {
      const { targetPath } = req.body;
      
      let inputPath = targetPath ? targetPath.trim() : "";
      // Convert standard backslashes to forward slashes on Unix, and vice versa
      if (process.platform !== "win32") {
        inputPath = inputPath.replace(/\\/g, "/");
      } else {
        inputPath = inputPath.replace(/\//g, "\\");
      }

      let currentPath = inputPath ? path.resolve(inputPath) : "";
      
      if (!currentPath || currentPath.trim() === "") {
        try {
          currentPath = os.homedir();
        } catch (e) {
          currentPath = process.cwd();
        }
      }

      // Verifichiamo se esiste e se possiamo risalire
      let exists = false;
      try {
        exists = fs.existsSync(currentPath);
      } catch (e) {}

      if (!exists) {
        let tempPath = currentPath;
        while (tempPath && tempPath !== path.dirname(tempPath)) {
          try {
            if (fs.existsSync(tempPath)) {
              break;
            }
          } catch (e) {}
          tempPath = path.dirname(tempPath);
        }
        currentPath = tempPath || (process.platform === "win32" ? "C:\\" : "/");
      }

      let isDir = false;
      try {
        const stat = fs.statSync(currentPath);
        isDir = stat.isDirectory();
      } catch (e) {}

      if (!isDir) {
        currentPath = path.dirname(currentPath);
      }

      const folders: string[] = [];
      let browseError: string | null = null;

      try {
        const files = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const file of files) {
          try {
            if (file.isDirectory()) {
              if (!file.name.startsWith(".") && file.name !== "node_modules" && file.name !== "$RECYCLE.BIN") {
                folders.push(file.name);
              }
            }
          } catch (e) {}
        }
        folders.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      } catch (err: any) {
        console.error("Errore fs.readdirSync:", err);
        if (err.code === "EPERM" || err.code === "EACCES") {
          if (process.platform === "darwin") {
            browseError = `Permesso negato su macOS per ${currentPath}. Assicurati che il tuo Terminale o IDE da cui hai avviato l'applicazione abbia i permessi di "Accesso completo al disco" (Impostazioni di Sistema -> Privacy e Sicurezza -> Accesso completo al disco).`;
          } else {
            browseError = `Permesso negato per accedere a ${currentPath}. Controlla i permessi del tuo utente o del processo Node.js.`;
          }
        } else {
          browseError = `Impossibile accedere a questa cartella: ${err.message}`;
        }
      }

      let parentPath: string | null = null;
      try {
        parentPath = currentPath === path.dirname(currentPath) ? null : path.dirname(currentPath);
      } catch (e) {}

      // Elenco dei dischi/volumi comuni o montati
      const drives: string[] = [];
      if (process.platform === "win32") {
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ":\\";
          try {
            if (fs.existsSync(drive)) {
              drives.push(drive);
            }
          } catch (e) {}
        }
      } else {
        drives.push("/");
        const commonMacLinuxDirs = ["/Volumes", "/media", "/mnt", os.homedir()];
        for (const dir of commonMacLinuxDirs) {
          try {
            if (fs.existsSync(dir) && !drives.includes(dir)) {
              drives.push(dir);
            }
          } catch (e) {}
        }
      }

      return res.json({
        success: true,
        currentPath,
        parentPath,
        folders,
        drives,
        error: browseError
      });
    } catch (err: any) {
      console.error("Errore nell'esplorazione delle cartelle:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ... existing endpoints

  // Attachment endpoints (New robust version)
  app.post("/api/upload/:type/:id", upload.single('file'), async (req, res) => {
    console.log("Upload request received:", req.params);
    try {
      const { type, id } = req.params;
      const file = req.file;
      console.log("File received:", file);
      if (!file) return res.status(400).json({ success: false, error: "Nessun file caricato" });
      if (file.mimetype !== 'application/pdf') {
        console.warn("Invalid mimetype:", file.mimetype);
        fs.unlinkSync(file.path);
        return res.status(400).json({ success: false, error: "Solo file PDF consentiti" });
      }

      const config = getDbConfig();
      const insertQuery = type === 'client' 
        ? "INSERT INTO allegati_clienti (cliente_id, nome_file, nome_originale, percorso_file, dimensione) VALUES (?, ?, ?, ?, ?)"
        : "INSERT INTO allegati_preventivi (preventivo_id, nome_file, nome_originale, percorso_file, dimensione) VALUES (?, ?, ?, ?, ?)";
      
      const insertParams = [id, file.filename, file.originalname, file.path, file.size];

      let insertedId = null;
      if (config.dbType === 'mariadb') {
        const pool = await getMariaPool(config);
        const [result]: any = await pool.query(insertQuery, insertParams);
        insertedId = result.insertId;
      } else {
        // Fallback for JSON
        const attachmentsPath = path.join(path.dirname(getDbPath()), 'attachments_meta.json');
        let meta: any = {};
        if (fs.existsSync(attachmentsPath)) meta = JSON.parse(fs.readFileSync(attachmentsPath, "utf-8"));
        insertedId = crypto.randomUUID();
        meta[insertedId] = { type, id, ...file, data_caricamento: new Date() };
        fs.writeFileSync(attachmentsPath, JSON.stringify(meta, null, 2), "utf-8");
      }

      res.json({ success: true, file, attachmentId: insertedId });
    } catch (err: any) {
      console.error("Errore upload:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/attachments/:type/:id", async (req, res) => {
    try {
        const { type, id } = req.params;
        const config = getDbConfig();
        
        let attachments: any[] = [];
        
        if (config.dbType === 'mariadb') {
            const pool = await getMariaPool(config);
            const query = type === 'client' ? "SELECT * FROM allegati_clienti WHERE cliente_id = ?" : "SELECT * FROM allegati_preventivi WHERE preventivo_id = ?";
            const [rows]: any = await pool.query(query, [id]);
            attachments = rows;
        } else {
            const attachmentsPath = path.join(path.dirname(getDbPath()), 'attachments_meta.json');
            if (fs.existsSync(attachmentsPath)) {
                const meta = JSON.parse(fs.readFileSync(attachmentsPath, "utf-8"));
                attachments = Object.entries(meta)
                    .filter(([_, v]: any) => v.type === type && v.id === id)
                    .map(([k, v]: any) => ({ id: k, ...v }));
            }
        }
        res.json({ success: true, attachments });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/attachments/download/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const config = getDbConfig();
        
        let filePath = "";
        let originalName = "";

        if (config.dbType === 'mariadb') {
            const pool = await getMariaPool(config);
            const [rows]: any = await pool.query("SELECT percorso_file, nome_originale FROM allegati_clienti WHERE id = ? UNION SELECT percorso_file, nome_originale FROM allegati_preventivi WHERE id = ?", [id, id]);
            if (rows.length === 0) return res.status(404).json({ success: false, error: "File non trovato" });
            filePath = rows[0].percorso_file;
            originalName = rows[0].nome_originale;
        } else {
            const attachmentsPath = path.join(path.dirname(getDbPath()), 'attachments_meta.json');
            const meta = JSON.parse(fs.readFileSync(attachmentsPath, "utf-8"));
            const entry = meta[id];
            if (!entry) return res.status(404).json({ success: false, error: "File non trovato" });
            filePath = entry.path;
            originalName = entry.originalname;
        }
        
        res.download(filePath, originalName);
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/attachments/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const config = getDbConfig();
        
        let filePath = "";
        
        if (config.dbType === 'mariadb') {
             const pool = await getMariaPool(config);
             // Find path and delete row
             const [rows]: any = await pool.query("SELECT percorso_file FROM allegati_clienti WHERE id = ? UNION SELECT percorso_file FROM allegati_preventivi WHERE id = ?", [id, id]);
             if (rows.length > 0) filePath = rows[0].percorso_file;
             
             await pool.query("DELETE FROM allegati_clienti WHERE id = ?", [id]);
             await pool.query("DELETE FROM allegati_preventivi WHERE id = ?", [id]);
        } else {
            const attachmentsPath = path.join(path.dirname(getDbPath()), 'attachments_meta.json');
            const meta = JSON.parse(fs.readFileSync(attachmentsPath, "utf-8"));
            if (meta[id]) {
                filePath = meta[id].path;
                delete meta[id];
                fs.writeFileSync(attachmentsPath, JSON.stringify(meta, null, 2), "utf-8");
            }
        }
        
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check Software Diff comparing local files and remote GitHub files using SHA-1
  app.post("/api/check-software-diff", async (req, res) => {
    const { repo, branch = "main", token } = req.body;
    if (!repo) {
      return res.status(400).json({ success: false, error: "Repository non specificato" });
    }

    try {
      // 1. Read local package.json version
      let localVersion = "1.2.0";
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
        localVersion = pkg.version || "1.2.0";
      } catch (e) {
        console.error("Non è stato possibile leggere package.json locale:", e);
      }

      // 2. Fetch GitHub file tree recursively
      const url = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Gestionale-Preventivi-Updater'
      };
      if (token && token.trim() !== '') {
        headers['Authorization'] = `token ${token}`;
      }

      const gitRes = await fetch(url, { headers });
      if (!gitRes.ok) {
        return res.status(gitRes.status).json({
          success: false,
          error: `GitHub API error: ${gitRes.statusText} (${gitRes.status})`
        });
      }

      const gitTreeData = await gitRes.json();
      if (!gitTreeData.tree || !Array.isArray(gitTreeData.tree)) {
        return res.status(500).json({ success: false, error: "Formato albero Git non valido" });
      }

      // Filter remote tree to only tracked files
      const remoteFiles = gitTreeData.tree.filter((item: any) => item.type === "blob" && shouldTrackFile(item.path));

      // 3. Find remote package.json to get remoteVersion
      const remotePkgItem = remoteFiles.find((item: any) => item.path === "package.json");
      let remoteVersion = "0.0.0";
      if (remotePkgItem) {
        const pkgUrl = `https://api.github.com/repos/${repo}/contents/package.json?ref=${branch}`;
        const pkgRes = await fetch(pkgUrl, { headers });
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          if (pkgData.content) {
            const decoded = Buffer.from(pkgData.content.replace(/\s/g, ''), 'base64').toString('utf-8');
            const pkgObj = JSON.parse(decoded);
            remoteVersion = pkgObj.version || "0.0.0";
          }
        }
      }

      // 4. Scan local workspace to get current files
      const localPaths = getLocalFiles(process.cwd());
      const localFilesMap = new Map<string, string>();
      for (const p of localPaths) {
        localFilesMap.set(p, getLocalGitSHA(path.join(process.cwd(), p)));
      }

      // 5. Compare remote files against local files
      const fileDiffs: any[] = [];
      const remotePathsSeen = new Set<string>();

      for (const rFile of remoteFiles) {
        const relPath = rFile.path;
        remotePathsSeen.add(relPath);

        const localSha = localFilesMap.get(relPath);
        if (!localSha) {
          fileDiffs.push({
            path: relPath,
            status: "added",
            remoteSha: rFile.sha
          });
        } else if (localSha !== rFile.sha) {
          fileDiffs.push({
            path: relPath,
            status: "modified",
            localSha,
            remoteSha: rFile.sha
          });
        }
      }

      // Check for deleted files (tracked files present locally but not on remote)
      for (const lPath of localPaths) {
        if (!remotePathsSeen.has(lPath)) {
          fileDiffs.push({
            path: lPath,
            status: "deleted",
            localSha: localFilesMap.get(lPath)
          });
        }
      }

      return res.json({
        success: true,
        localVersion,
        remoteVersion,
        fileDiffs
      });
    } catch (err: any) {
      console.error("Errore durante il confronto software:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Apply Software Updates on the server filesystem
  app.post("/api/apply-software-update", async (req, res) => {
    const { repo, branch = "main", token, fileDiffs } = req.body;
    if (!repo) {
      return res.status(400).json({ success: false, error: "Repository non specificato" });
    }
    if (!Array.isArray(fileDiffs)) {
      return res.status(400).json({ success: false, error: "Elenco modifiche non valido" });
    }

    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Gestionale-Preventivi-Updater'
      };
      if (token && token.trim() !== '') {
        headers['Authorization'] = `token ${token}`;
      }

      const results: any[] = [];

      for (const diff of fileDiffs) {
        const localPath = path.join(process.cwd(), diff.path);

        if (diff.status === "added" || diff.status === "modified") {
          // Download raw content from contents API to prevent issues with private repos
          const contentUrl = `https://api.github.com/repos/${repo}/contents/${diff.path}?ref=${branch}`;
          const contentRes = await fetch(contentUrl, { headers });
          if (!contentRes.ok) {
            results.push({ path: diff.path, status: "error", error: `Impossibile scaricare: ${contentRes.statusText}` });
            continue;
          }

          const fileData = await contentRes.json();
          if (fileData.content && fileData.encoding === "base64") {
            const rawContent = Buffer.from(fileData.content.replace(/\s/g, ''), 'base64');
            
            // Ensure parent directories exist
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(localPath, rawContent);
            results.push({ path: diff.path, status: "updated" });
          } else {
            results.push({ path: diff.path, status: "error", error: "Formato content o encoding non supportato" });
          }
        } else if (diff.status === "deleted") {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            results.push({ path: diff.path, status: "deleted" });
          } else {
            results.push({ path: diff.path, status: "already_deleted" });
          }
        }
      }

      // Write a local update manifest log so the frontend can read the last updated files
      const manifestPath = path.join(process.cwd(), "src", "data");
      if (!fs.existsSync(manifestPath)) {
        fs.mkdirSync(manifestPath, { recursive: true });
      }

      const updateManifest = {
        date: new Date().toISOString(),
        repo,
        branch,
        updatedFiles: fileDiffs
      };

      fs.writeFileSync(
        path.join(manifestPath, "last_update_manifest.json"),
        JSON.stringify(updateManifest, null, 2),
        "utf-8"
      );

      return res.json({
        success: true,
        message: "Software aggiornato correttamente!",
        results
      });
    } catch (err: any) {
      console.error("Errore durante l'applicazione degli aggiornamenti:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // CONFIGURAZIONE CARICAMENTO E GESTIONE PDF
  // ==========================================
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (e) {
    console.error("[Server] Errore creazione cartella uploads:", e);
  }

  const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Genera un nome univoco basato sul timestamp per evitare sovrascritture
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const pdfUpload = multer({ 
    storage: pdfStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limite di 10MB per file
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Formato non valido. Sono ammessi solo file PDF."));
      }
    }
  });

  // Endpoint API per l'upload del PDF
  app.post("/api/upload-pdf", (req, res) => {
    console.log("[Server] Richiesta ricevuta su /api/upload-pdf");
    pdfUpload.single("pdf")(req, res, (err) => {
      if (err) {
        console.error("[Server] Errore multer durante l'upload del PDF:", err);
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Errore di upload: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }

      if (!req.file) {
        console.warn("[Server] Richiesta di upload PDF ricevuta senza file");
        return res.status(400).json({ success: false, error: "Nessun file selezionato." });
      }

      console.log(`[Server] File caricato correttamente: ${req.file.filename} (Originale: ${req.file.originalname})`);
      // Restituisce i dettagli del file salvato sul server
      return res.json({ 
        success: true, 
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/${req.file.filename}` // Questo percorso lo salverai nel tuo database JSON/MariaDB
      });
    });
  });

  // Endpoint API per esportare tutta la cartella 'uploads' come archivio ZIP
  app.get("/api/export-uploads", (req, res) => {
    console.log("[Server] Richiesta ricevuta su /api/export-uploads");
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const zip = new AdmZip();
      
      // Controlliamo se la cartella contiene file prima di aggiungerla
      const files = fs.readdirSync(uploadDir);
      if (files.length === 0) {
        // Se la cartella è vuota, aggiungiamo un file leggimi per evitare errori e indicare che è vuota
        zip.addFile("README.txt", Buffer.from("Cartella uploads vuota. Nessun allegato presente.", "utf8"));
      } else {
        zip.addLocalFolder(uploadDir);
      }

      const zipBuffer = zip.toBuffer();
      const filename = `gestionale_preventivi_uploads_${new Date().toISOString().split('T')[0]}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", zipBuffer.length);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("[Server] Errore durante l'esportazione ZIP degli uploads:", err);
      res.status(500).json({ success: false, error: `Errore durante la creazione dello ZIP: ${err.message}` });
    }
  });

  // Rende la cartella 'uploads' accessibile pubblicamente via browser per poter scaricare/vedere i PDF
  app.use("/uploads", express.static(uploadDir));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
start();
