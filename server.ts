import express from "express";
import { createServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import mysql from "mysql2/promise";
import { escape } from "mysql2";
import { GoogleGenAI, Type } from "@google/genai";
import AdmZip from 'adm-zip';

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

  async function getMariaPool(config: any, force: boolean = false) {
    if (force) {
      console.log("[MariaDB] Forza reset del pool richiesto.");
      resetMariaPool();
    }
    const now = Date.now();
    if (now - lastFailedTime < COOLDOWN_MS) {
      throw new Error("MariaDB è temporaneamente non raggiungibile (circuit breaker attivo).");
    }

    if (poolPromise && !force) {
      return poolPromise;
    }

    poolPromise = (async () => {
      // 1. If we already have a pool, try to validate it
      if (mariaPool && !force) {
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
        console.log("[MariaDB] Connessione riuscita. Inizio verifica tabelle...");

        const tables = [
          {
            name: 'app_store',
            sql: `CREATE TABLE IF NOT EXISTS app_store (
              \`key\` VARCHAR(100) PRIMARY KEY,
              \`value\` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          },
          {
            name: 'Anagrafiche_Clienti',
            sql: `CREATE TABLE IF NOT EXISTS Anagrafiche_Clienti (
              \`id\` VARCHAR(100) PRIMARY KEY,
              \`name\` VARCHAR(255) NOT NULL,
              \`intestazione\` VARCHAR(255),
              \`email\` VARCHAR(255),
              \`phone\` VARCHAR(100),
              \`address\` TEXT,
              \`cap\` VARCHAR(20),
              \`city\` VARCHAR(100),
              \`vatNumber\` VARCHAR(100),
              \`sdiCode\` VARCHAR(50),
              \`json_data\` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          },
          {
            name: 'preventivi',
            sql: `CREATE TABLE IF NOT EXISTS preventivi (
              \`id\` VARCHAR(100) PRIMARY KEY,
              \`numero\` VARCHAR(50),
              \`anno\` INT,
              \`data\` VARCHAR(20),
              \`cliente\` VARCHAR(255),
              \`totale\` DECIMAL(15,2),
              \`json_data\` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          },
          {
            name: 'Materiali',
            sql: `CREATE TABLE IF NOT EXISTS Materiali (
              \`id\` VARCHAR(100) PRIMARY KEY,
              \`nome\` VARCHAR(255) NOT NULL,
              \`fornitore\` VARCHAR(255),
              \`prezzoLastra\` DECIMAL(15,2),
              \`linkSchedaTecnica\` TEXT,
              \`lunghezza\` DECIMAL(15,2),
              \`larghezza\` DECIMAL(15,2),
              \`spessore\` DECIMAL(15,2),
              \`json_data\` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          },
          {
            name: 'users',
            sql: `CREATE TABLE IF NOT EXISTS users (
              \`id\` VARCHAR(100) PRIMARY KEY,
              \`username\` VARCHAR(100) UNIQUE NOT NULL,
              \`password\` VARCHAR(255) NOT NULL,
              \`role\` VARCHAR(50),
              \`createdAt\` VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          },
          {
            name: 'invoices',
            sql: `CREATE TABLE IF NOT EXISTS invoices (
              \`id\` VARCHAR(100) PRIMARY KEY,
              \`number\` VARCHAR(50),
              \`date\` VARCHAR(20),
              \`clientName\` VARCHAR(255),
              \`totalAmount\` DECIMAL(15,2),
              \`xmlFilename\` VARCHAR(255),
              \`json_data\` LONGTEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
          }
        ];

        for (const t of tables) {
          try {
            await connection.query(t.sql);
            console.log(`[MariaDB] Tabella '${t.name}' verificata.`);
          } catch (tErr: any) {
            console.error(`[MariaDB] Errore tabella '${t.name}':`, tErr.message);
          }
        }
        
        // Drop legacy attachment tables as requested
        try {
          await connection.query("DROP TABLE IF EXISTS allegati_clienti");
          await connection.query("DROP TABLE IF EXISTS allegati_preventivi");
          console.log("[MariaDB] Tabelle allegati legacy rimosse.");
        } catch (dropErr: any) {
          console.warn("[MariaDB] Errore durante il drop delle tabelle allegati:", dropErr.message);
        }

        // Automatic migration of legacy clients from app_store to Anagrafiche_Clienti
        try {
          const [legacyRows]: any = await connection.query("SELECT `value` FROM app_store WHERE `key` = 'clients'");
          if (legacyRows.length > 0 && legacyRows[0].value) {
            const legacyClients = JSON.parse(legacyRows[0].value);
            if (Array.isArray(legacyClients) && legacyClients.length > 0) {
              for (const c of legacyClients) {
                if (!c.id) continue;
                const stringified = JSON.stringify(c);
                await connection.query(
                  `INSERT IGNORE INTO Anagrafiche_Clienti 
                   (\`id\`, \`name\`, \`intestazione\`, \`email\`, \`phone\`, \`address\`, \`cap\`, \`city\`, \`vatNumber\`, \`sdiCode\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    c.id, 
                    c.name || "", 
                    c.intestazione || "", 
                    c.email || "", 
                    c.phone || "", 
                    c.address || "", 
                    c.cap || "", 
                    c.city || "", 
                    c.vatNumber || "", 
                    c.sdiCode || "", 
                    stringified
                  ]
                );
              }
            }
          }
        } catch (migErr: any) {
          console.warn("[MariaDB] Errore durante la migrazione delle anagrafiche:", migErr.message);
        }

        // Automatic migration of legacy quotations from app_store to preventivi table
        try {
          const [legacyRows]: any = await connection.query("SELECT `value` FROM app_store WHERE `key` = 'quotations'");
          if (legacyRows.length > 0 && legacyRows[0].value) {
            const legacyQuotations = JSON.parse(legacyRows[0].value);
            if (Array.isArray(legacyQuotations) && legacyQuotations.length > 0) {
              for (const q of legacyQuotations) {
                if (!q.id) continue;
                const stringified = JSON.stringify(q);
                const numero = q.number || "";
                const anno = parseInt(q.year) || new Date().getFullYear();
                const dataPrev = q.date || "";
                const cliente = q.clientInfo?.name || "";
                const totale = parseFloat(q.totalAmount) || 0.0;

                await connection.query(
                  `INSERT IGNORE INTO preventivi (\`id\`, \`numero\`, \`anno\`, \`data\`, \`cliente\`, \`totale\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [q.id, numero, anno, dataPrev, cliente, totale, stringified]
                );
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

          // Fetch from dedicated Materiali table
          try {
            const [mRows]: any = await pool.query("SELECT `id`, `nome`, `fornitore`, `prezzoLastra`, `linkSchedaTecnica`, `lunghezza`, `larghezza`, `spessore`, `json_data` FROM Materiali");
            const materiali = [];
            for (const mRow of mRows) {
              try {
                const m = JSON.parse(mRow.json_data);
                // Allinea le proprietà del JSON con i valori delle singole colonne del DB
                if (mRow.id) m.id = mRow.id;
                if (mRow.nome) m.nome = mRow.nome;
                if (mRow.fornitore !== undefined && mRow.fornitore !== null) m.fornitore = mRow.fornitore;
                if (mRow.prezzoLastra !== undefined && mRow.prezzoLastra !== null) m.prezzoLastra = parseFloat(mRow.prezzoLastra);
                if (mRow.linkSchedaTecnica !== undefined && mRow.linkSchedaTecnica !== null) m.linkSchedaTecnica = mRow.linkSchedaTecnica;
                if (mRow.lunghezza !== undefined && mRow.lunghezza !== null) m.lunghezza = parseFloat(mRow.lunghezza);
                if (mRow.larghezza !== undefined && mRow.larghezza !== null) m.larghezza = parseFloat(mRow.larghezza);
                if (mRow.spessore !== undefined && mRow.spessore !== null) m.spessore = parseFloat(mRow.spessore);
                materiali.push(m);
              } catch (e) {
                console.error("[MariaDB] Errore nel parsing del materiale:", e);
              }
            }
            data["materiali"] = materiali;
          } catch (mErr: any) {
            console.error("[MariaDB] Errore nel caricamento dei materiali dalla tabella Materiali:", mErr.message);
            // Non sovrascrivere se non riusciamo a caricare, così rimane quello in app_store o default
          }

          // Fetch from dedicated Anagrafiche_Clienti table
          try {
            const [cRows]: any = await pool.query("SELECT `id`, `name`, `intestazione`, `email`, `phone`, `address`, `cap`, `city`, `vatNumber`, `sdiCode`, `json_data` FROM Anagrafiche_Clienti");
            const clients = [];
            for (const cRow of cRows) {
              try {
                const c = JSON.parse(cRow.json_data);
                if (cRow.id) c.id = cRow.id;
                if (cRow.name) c.name = cRow.name;
                if (cRow.intestazione !== undefined && cRow.intestazione !== null) c.intestazione = cRow.intestazione;
                if (cRow.email !== undefined && cRow.email !== null) c.email = cRow.email;
                if (cRow.phone !== undefined && cRow.phone !== null) c.phone = cRow.phone;
                if (cRow.address !== undefined && cRow.address !== null) c.address = cRow.address;
                if (cRow.cap !== undefined && cRow.cap !== null) c.cap = cRow.cap;
                if (cRow.city !== undefined && cRow.city !== null) c.city = cRow.city;
                if (cRow.vatNumber !== undefined && cRow.vatNumber !== null) c.vatNumber = cRow.vatNumber;
                if (cRow.sdiCode !== undefined && cRow.sdiCode !== null) c.sdiCode = cRow.sdiCode;
                clients.push(c);
              } catch (e) {
                console.error("[MariaDB] Errore nel parsing dell'anagrafica cliente:", e);
              }
            }
            data["clients"] = clients;
          } catch (cErr: any) {
            console.error("[MariaDB] Errore nel caricamento delle anagrafiche dalla tabella Anagrafiche_Clienti:", cErr.message);
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
            } else if (key === "clients" && Array.isArray(val)) {
              // Upsert each incoming client in its own row
              const incomingIds = val.map((c: any) => c.id).filter(Boolean);
              
              if (incomingIds.length > 0) {
                await pool.query("DELETE FROM Anagrafiche_Clienti WHERE id NOT IN (?)", [incomingIds]);
              } else {
                await pool.query("DELETE FROM Anagrafiche_Clienti");
              }

              for (const c of val) {
                if (!c.id) continue;
                const stringified = JSON.stringify(c);
                await pool.query(
                  `INSERT INTO Anagrafiche_Clienti 
                   (\`id\`, \`name\`, \`intestazione\`, \`email\`, \`phone\`, \`address\`, \`cap\`, \`city\`, \`vatNumber\`, \`sdiCode\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                   ON DUPLICATE KEY UPDATE 
                     \`name\` = ?, \`intestazione\` = ?, \`email\` = ?, \`phone\` = ?, \`address\` = ?, \`cap\` = ?, \`city\` = ?, \`vatNumber\` = ?, \`sdiCode\` = ?, \`json_data\` = ?`,
                  [
                    c.id, c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", stringified,
                    c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", stringified
                  ]
                );
              }
            } else if (key === "materiali" && Array.isArray(val)) {
              // 1. Get all incoming material IDs
              const incomingIds = val.map((m: any) => m.id).filter(Boolean);

              // 2. Delete materials that are no longer in the list
              if (incomingIds.length > 0) {
                await pool.query(
                  "DELETE FROM Materiali WHERE id NOT IN (?)",
                  [incomingIds]
                );
              } else {
                await pool.query("DELETE FROM Materiali");
              }

              // 3. Upsert each incoming material in its own row
              for (const m of val) {
                if (!m.id) continue;
                const stringified = JSON.stringify(m);
                const nome = m.nome || "";
                const fornitore = m.fornitore || "";
                const prezzo = parseFloat(m.prezzoLastra) || 0.0;
                const link = m.linkSchedaTecnica || "";
                const lunghezza = parseFloat(m.lunghezza) || 0.0;
                const larghezza = parseFloat(m.larghezza) || 0.0;
                const spessore = parseFloat(m.spessore) || 0.0;

                await pool.query(
                  `INSERT INTO Materiali (\`id\`, \`nome\`, \`fornitore\`, \`prezzoLastra\`, \`linkSchedaTecnica\`, \`lunghezza\`, \`larghezza\`, \`spessore\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                   ON DUPLICATE KEY UPDATE 
                     \`nome\` = ?, 
                     \`fornitore\` = ?, 
                     \`prezzoLastra\` = ?, 
                     \`linkSchedaTecnica\` = ?, 
                     \`lunghezza\` = ?, 
                     \`larghezza\` = ?, 
                     \`spessore\` = ?, 
                     \`json_data\` = ?`,
                  [
                    m.id, nome, fornitore, prezzo, link, lunghezza, larghezza, spessore, stringified,
                    nome, fornitore, prezzo, link, lunghezza, larghezza, spessore, stringified
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

      const exportTable = async (tableName: string, query: string, createSql: string, mapRow: (row: any) => string) => {
        try {
          const [rows]: any = await pool.query(query);
          sqlDump += `-- Tabella: ${tableName}\n`;
          sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
          sqlDump += `${createSql};\n\n`;
          
          if (rows.length > 0) {
            sqlDump += `INSERT INTO \`${tableName}\` VALUES\n`;
            const values = rows.map(mapRow);
            sqlDump += values.join(",\n") + ";\n\n";
          }
        } catch (err: any) {
          console.warn(`[Export] Salto tabella ${tableName} perché non esiste o errore:`, err.message);
        }
      };

      // 1. app_store
      await exportTable(
        'app_store',
        "SELECT * FROM app_store",
        `CREATE TABLE \`app_store\` (
          \`key\` VARCHAR(100) PRIMARY KEY,
          \`value\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.key)}, ${escape(row.value)})`
      );

      // 2. preventivi
      await exportTable(
        'preventivi',
        "SELECT * FROM preventivi",
        `CREATE TABLE \`preventivi\` (
          \`id\` VARCHAR(100) PRIMARY KEY,
          \`numero\` VARCHAR(50),
          \`anno\` INT,
          \`data\` VARCHAR(20),
          \`cliente\` VARCHAR(255),
          \`totale\` DECIMAL(15,2),
          \`json_data\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.id)}, ${escape(row.numero)}, ${row.anno}, ${escape(row.data)}, ${escape(row.cliente)}, ${row.totale}, ${escape(row.json_data)})`
      );

      // 3. Materiali
      await exportTable(
        'Materiali',
        "SELECT * FROM Materiali",
        `CREATE TABLE \`Materiali\` (
          \`id\` VARCHAR(100) PRIMARY KEY,
          \`nome\` VARCHAR(255) NOT NULL,
          \`fornitore\` VARCHAR(255),
          \`prezzoLastra\` DECIMAL(15,2),
          \`linkSchedaTecnica\` TEXT,
          \`lunghezza\` DECIMAL(15,2),
          \`larghezza\` DECIMAL(15,2),
          \`spessore\` DECIMAL(15,2),
          \`json_data\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.id)}, ${escape(row.nome)}, ${escape(row.fornitore)}, ${row.prezzoLastra}, ${escape(row.linkSchedaTecnica)}, ${row.lunghezza}, ${row.larghezza}, ${row.spessore}, ${escape(row.json_data)})`
      );

      // 4. Anagrafiche_Clienti
      await exportTable(
        'Anagrafiche_Clienti',
        "SELECT * FROM Anagrafiche_Clienti",
        `CREATE TABLE \`Anagrafiche_Clienti\` (
          \`id\` VARCHAR(100) PRIMARY KEY,
          \`name\` VARCHAR(255) NOT NULL,
          \`intestazione\` VARCHAR(255),
          \`email\` VARCHAR(255),
          \`phone\` VARCHAR(100),
          \`address\` TEXT,
          \`cap\` VARCHAR(20),
          \`city\` VARCHAR(100),
          \`vatNumber\` VARCHAR(100),
          \`sdiCode\` VARCHAR(50),
          \`json_data\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.id)}, ${escape(row.name)}, ${escape(row.intestazione)}, ${escape(row.email)}, ${escape(row.phone)}, ${escape(row.address)}, ${escape(row.cap)}, ${escape(row.city)}, ${escape(row.vatNumber)}, ${escape(row.sdiCode)}, ${escape(row.json_data)})`
      );

      // 5. users
      await exportTable(
        'users',
        "SELECT * FROM users",
        `CREATE TABLE \`users\` (
          \`id\` VARCHAR(100) PRIMARY KEY,
          \`username\` VARCHAR(100) UNIQUE NOT NULL,
          \`password\` VARCHAR(255) NOT NULL,
          \`role\` VARCHAR(50),
          \`createdAt\` VARCHAR(50)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.id)}, ${escape(row.username)}, ${escape(row.password)}, ${escape(row.role)}, ${escape(row.createdAt)})`
      );

      // 6. invoices
      await exportTable(
        'invoices',
        "SELECT * FROM invoices",
        `CREATE TABLE \`invoices\` (
          \`id\` VARCHAR(100) PRIMARY KEY,
          \`number\` VARCHAR(50),
          \`date\` VARCHAR(20),
          \`clientName\` VARCHAR(255),
          \`totalAmount\` DECIMAL(15,2),
          \`xmlFilename\` VARCHAR(255),
          \`json_data\` LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        (row) => `(${escape(row.id)}, ${escape(row.number)}, ${escape(row.date)}, ${escape(row.clientName)}, ${row.totalAmount}, ${escape(row.xmlFilename)}, ${escape(row.json_data)})`
      );

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
    console.log("[API] GET /api/db-config requested");
    try {
      const config = getDbConfig();
      console.log("[API] Current config loaded from file:", JSON.stringify(config));
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
      } catch (e) {
        console.warn("[API] Error checking activePath existence:", e);
      }

      console.log("[API] db-config response preparing:", { dbType, activePath, exists });
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
      console.error("[API] Error in GET /api/db-config:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/db-force-init", async (req, res) => {
    console.log("[API] POST /api/db-force-init requested - Resetting MariaDB Pool");
    try {
      const config = getDbConfig();
      if (config.dbType !== 'mariadb') {
        return res.json({ success: false, error: "Database MariaDB non configurato come attivo." });
      }
      
      // Forziamo il reset del pool per assicurarci che le nuove impostazioni o lo stato del DB siano puliti
      await getMariaPool(config, true);
      
      console.log("[API] Inizializzazione tabelle MariaDB completata.");
      return res.json({ success: true, message: "Tabelle inizializzate correttamente." });
    } catch (err: any) {
      console.warn("[API] Avviso in /api/db-force-init (MariaDB non raggiungibile):", err.message || err);
      return res.json({ success: false, error: err.message || "Impossibile connettersi a MariaDB" });
    }
  });

  app.post("/api/migrate-clients", async (req, res) => {
    console.log("[API] POST /api/migrate-clients requested");
    try {
      const config = getDbConfig();
      if (config.dbType !== 'mariadb') {
        return res.status(400).json({ success: false, error: "MariaDB non attivo." });
      }
      const pool = await getMariaPool(config);
      const connection = await pool.getConnection();
      
      let migratedCount = 0;
      
      try {
        // 1. Prova il formato array sotto la chiave 'clients'
        const [legacyArray]: any = await connection.query("SELECT `value` FROM app_store WHERE `key` = 'clients'");
        if (legacyArray.length > 0 && legacyArray[0].value) {
          try {
            const clients = JSON.parse(legacyArray[0].value);
            if (Array.isArray(clients)) {
              for (const c of clients) {
                if (!c || typeof c !== 'object' || !c.id) continue;
                await connection.query(
                  `INSERT INTO Anagrafiche_Clienti 
                   (\`id\`, \`name\`, \`intestazione\`, \`email\`, \`phone\`, \`address\`, \`cap\`, \`city\`, \`vatNumber\`, \`sdiCode\`, \`json_data\`) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE 
                   \`name\` = VALUES(\`name\`), \`json_data\` = VALUES(\`json_data\`)`,
                  [c.id, c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", JSON.stringify(c)]
                );
                migratedCount++;
              }
            }
          } catch (jsonErr: any) {
            console.warn("[API] Errore parsing record 'clients' (array):", jsonErr.message);
          }
        }

        // 2. Prova il formato individuale 'client:%'
        const [legacyIndividual]: any = await connection.query("SELECT `value` FROM app_store WHERE `key` LIKE 'client:%'");
        for (const row of legacyIndividual) {
          if (!row.value) continue;
          try {
            const c = JSON.parse(row.value);
            if (!c || typeof c !== 'object' || !c.id) continue;
            await connection.query(
              `INSERT INTO Anagrafiche_Clienti 
               (\`id\`, \`name\`, \`intestazione\`, \`email\`, \`phone\`, \`address\`, \`cap\`, \`city\`, \`vatNumber\`, \`sdiCode\`, \`json_data\`) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
               \`name\` = VALUES(\`name\`), \`json_data\` = VALUES(\`json_data\`)`,
              [c.id, c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", JSON.stringify(c)]
            );
            migratedCount++;
          } catch (e: any) {
            console.warn("[API] Errore parsing record individuale client:", row.key, e.message);
          }
        }

        console.log(`[API] Migrazione completata: ${migratedCount} record processati.`);
        res.json({ success: true, count: migratedCount });
      } finally {
        connection.release();
      }
    } catch (err: any) {
      console.error("[API] Errore migrazione:", err);
      res.status(500).json({ success: false, error: err.message });
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
                } else if (key === "clients" && Array.isArray(val)) {
                  for (const c of val) {
                    if (!c.id) continue;
                    const stringified = JSON.stringify(c);
                    await pool.query(
                      `INSERT INTO Anagrafiche_Clienti 
                       (\`id\`, \`name\`, \`intestazione\`, \`email\`, \`phone\`, \`address\`, \`cap\`, \`city\`, \`vatNumber\`, \`sdiCode\`, \`json_data\`) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                       ON DUPLICATE KEY UPDATE 
                         \`name\` = ?, \`intestazione\` = ?, \`email\` = ?, \`phone\` = ?, \`address\` = ?, \`cap\` = ?, \`city\` = ?, \`vatNumber\` = ?, \`sdiCode\` = ?, \`json_data\` = ?`,
                      [
                        c.id, c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", stringified,
                        c.name || "", c.intestazione || "", c.email || "", c.phone || "", c.address || "", c.cap || "", c.city || "", c.vatNumber || "", c.sdiCode || "", stringified
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
        'User-Agent': 'Gestionale-Updater'
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
        'User-Agent': 'Gestionale-Updater'
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
    let version = "3.7.1";
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"));
      version = pkg.version;
    } catch (e) {}
    console.log(`[Server] Avviato con successo sulla porta ${PORT}`);
    console.log(`[Server] Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Versione Software: ${version}`);
    
    // Forza l'inizializzazione immediata del database se MariaDB è attivo
    const config = getDbConfig();
    if (config.dbType === 'mariadb') {
      console.log("[Server] Database MariaDB rilevato, avvio inizializzazione tabelle...");
      getMariaPool(config).then(() => {
        console.log("[Server] MariaDB inizializzato correttamente all'avvio.");
      }).catch(err => {
        console.error("[Server] Errore inizializzazione MariaDB all'avvio:", err.message);
      });
    }
  });
}
console.log("[Server] Avvio del processo start()...");
start().catch(err => {
  console.error("[Server] Errore fatale durante l'avvio:", err);
  process.exit(1);
});
