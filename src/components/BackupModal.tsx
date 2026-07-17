import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileDown, 
  FileUp, 
  FolderDown,
  CheckCircle, 
  AlertTriangle, 
  Database, 
  Info,
  Layers,
  Trash2,
  Network,
  Save,
  RefreshCw,
  FolderOpen,
  Folder,
  CornerLeftUp,
  Home
} from 'lucide-react';
import { 
  exportLocalData, 
  importLocalData, 
  mergeLocalAndRemote 
} from '../lib/githubSync';
import { initializeLocalDatabase } from '../lib/db';
import { verifyDatiGestionaleSchemaConsistency } from '../lib/schemaValidator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBackupSuccess?: () => void;
}

export default function BackupModal({ isOpen, onClose, onBackupSuccess }: Props) {
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info' | null; text: string }>({ type: null, text: '' });
  const [stats, setStats] = useState({ quotationsCount: 0, clientsCount: 0 });

  // Configurazione database di rete/NAS / MariaDB
  const [dbConfig, setDbConfig] = useState<{
    dbType?: 'json' | 'mariadb';
    customPath: string;
    activePath: string;
    isCustom: boolean;
    exists: boolean;
    defaultPath: string;
    mariadbConfig?: {
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
    };
  } | null>(null);
  const [dbType, setDbType] = useState<'json' | 'mariadb'>('json');
  const [inputPath, setInputPath] = useState('');
  const [mariadbConfig, setMariadbConfig] = useState({
    host: 'localhost',
    port: 3306,
    database: 'preventivi_db',
    user: 'root',
    password: ''
  });
  const [copyExisting, setCopyExisting] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Stati per la navigazione delle cartelle
  const [isBrowsingFolders, setIsBrowsingFolders] = useState(false);
  const [browseCurrentPath, setBrowseCurrentPath] = useState('');
  const [browseParentPath, setBrowseParentPath] = useState<string | null>(null);
  const [browseFolders, setBrowseFolders] = useState<string[]>([]);
  const [browseDrives, setBrowseDrives] = useState<string[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [isExportingUploads, setIsExportingUploads] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<{
    run: boolean;
    isValid: boolean;
    errors: string[];
  } | null>(null);

  const handleReloadDatabase = async () => {
    setIsReloading(true);
    setStatusMsg({ type: null, text: '' });
    try {
      const success = await initializeLocalDatabase();
      if (success) {
        const updatedLocalData = exportLocalData();
        setStats({
          quotationsCount: updatedLocalData.quotations?.length || 0,
          clientsCount: updatedLocalData.clients?.length || 0
        });
        setStatusMsg({
          type: 'success',
          text: 'Database ricaricato ed allineato con successo! Tutti i dati sono stati sincronizzati con la versione corrente.'
        });
        if (onBackupSuccess) {
          onBackupSuccess();
        }
      } else {
        throw new Error("Impossibile completare il ricaricamento del database dal server.");
      }
    } catch (e: any) {
      console.error(e);
      setStatusMsg({
        type: 'error',
        text: `Errore durante il ricaricamento del database: ${e.message}`
      });
    } finally {
      setIsReloading(false);
    }
  };

  const handleRunDiagnostics = () => {
    try {
      const data = exportLocalData();
      const result = verifyDatiGestionaleSchemaConsistency(data);
      setDiagnosticResult({
        run: true,
        isValid: result.isValid,
        errors: result.errors
      });
    } catch (e: any) {
      setDiagnosticResult({
        run: true,
        isValid: false,
        errors: [`Errore durante l'esportazione dei dati per diagnostica: ${e.message}`]
      });
    }
  };

  const handleLoadFolder = async (pathStr: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await fetch('/api/browse-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: pathStr })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setBrowseCurrentPath(json.currentPath);
        setBrowseParentPath(json.parentPath);
        setBrowseFolders(json.folders || []);
        setBrowseDrives(json.drives || []);
        if (json.error) {
          setBrowseError(json.error);
        }
      } else {
        setBrowseError(json.error || 'Impossibile leggere la cartella.');
      }
    } catch (err: any) {
      setBrowseError(err.message || 'Errore di connessione.');
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleStartBrowsing = () => {
    setIsBrowsingFolders(!isBrowsingFolders);
    if (!isBrowsingFolders) {
      const startPath = inputPath.trim() !== '' ? inputPath.trim() : (dbConfig?.activePath || '');
      handleLoadFolder(startPath);
    }
  };

  const handleSelectBrowsedFolder = () => {
    setInputPath(browseCurrentPath);
    setIsBrowsingFolders(false);
  };

  const fetchDbConfig = async () => {
    try {
      const res = await fetch('/api/db-config');
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          setDbConfig(json);
          setDbType(json.dbType || 'json');
          setInputPath(json.customPath || '');
          if (json.mariadbConfig) {
            setMariadbConfig({
              host: json.mariadbConfig.host || 'localhost',
              port: parseInt(json.mariadbConfig.port) || 3306,
              database: json.mariadbConfig.database || 'preventivi_db',
              user: json.mariadbConfig.user || 'root',
              password: json.mariadbConfig.password || ''
            });
          }
        }
      }
    } catch (e) {
      console.error("Errore nel recupero della configurazione database:", e);
    }
  };

  const handleTestMariaDb = async () => {
    setTestingConnection(true);
    setTestResult({ type: null, message: '' });
    try {
      const res = await fetch('/api/test-mariadb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mariadbConfig)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestResult({
          type: 'success',
          message: json.message || 'Connessione stabilita con successo! Tabella app_store pronta.'
        });
      } else {
        setTestResult({
          type: 'error',
          message: json.error || 'Impossibile connettersi al database MariaDB.'
        });
      }
    } catch (e: any) {
      setTestResult({
        type: 'error',
        message: `Errore di connessione: ${e.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveDbConfig = async () => {
    setConfigSaving(true);
    setStatusMsg({ type: null, text: '' });
    try {
      const res = await fetch('/api/db-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType,
          customPath: inputPath,
          mariadbConfig,
          copyExisting
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Ricarica il database locale sul browser
        await initializeLocalDatabase();
        
        setStatusMsg({
          type: 'success',
          text: dbType === 'mariadb'
            ? `Configurazione MariaDB salvata con successo! ${
                json.migration === 'copied'
                  ? 'I dati attuali sono stati migrati sul database MariaDB.'
                  : 'I dati sono stati sincronizzati con il database MariaDB.'
              }`
            : `Configurazione database salvata con successo! ${
                json.migration === 'copied' 
                  ? 'I dati attuali sono stati copiati sul nuovo percorso di rete.' 
                  : 'I dati sono stati caricati correttamente dal percorso di rete specificato.'
              }`
        });

        // Aggiorna statistiche
        const updatedLocalData = exportLocalData();
        setStats({
          quotationsCount: updatedLocalData.quotations?.length || 0,
          clientsCount: updatedLocalData.clients?.length || 0
        });

        if (onBackupSuccess) onBackupSuccess();
        fetchDbConfig();
      } else {
        setStatusMsg({
          type: 'error',
          text: `Errore: ${json.error || 'Impossibile salvare la configurazione.'}`
        });
      }
    } catch (e: any) {
      setStatusMsg({
        type: 'error',
        text: `Errore di connessione: ${e.message}`
      });
    } finally {
      setConfigSaving(false);
    }
  };



  // Load current stats when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const localData = exportLocalData();
        setStats({
          quotationsCount: localData.quotations?.length || 0,
          clientsCount: localData.clients?.length || 0
        });
        setStatusMsg({ type: null, text: '' });
        fetchDbConfig();
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Local JSON or SQL Backup Export
  const handleLocalExport = async () => {
    try {
      setStatusMsg({ type: null, text: '' });
      if (dbType === 'mariadb') {
        // Scarica backup SQL completo di MariaDB dal server
        const response = await fetch('/api/backup/export-sql');
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Errore server: ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_mariadb_${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatusMsg({
          type: 'success',
          text: 'Backup MariaDB (.sql) scaricato correttamente! Il file contiene la struttura e i dati completi di tutte le tabelle.'
        });
      } else {
        const data = exportLocalData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gestionale_preventivi_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setStatusMsg({ 
          type: 'success', 
          text: 'Backup JSON scaricato correttamente! Il file contiene tutti i preventivi, le anagrafiche e i prodotti memorizzati.' 
        });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: `Errore durante l'esportazione: ${e.message}` });
    }
  };

  const handleExportUploads = async () => {
    try {
      setIsExportingUploads(true);
      setStatusMsg({ type: null, text: '' });
      
      const response = await fetch('/api/export-uploads');
      if (!response.ok) {
        throw new Error(`Errore server: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gestionale_preventivi_uploads_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: 'success',
        text: 'Cartella allegati (uploads) esportata correttamente come file ZIP! Controlla i tuoi download.'
      });
    } catch (e: any) {
      console.error(e);
      setStatusMsg({ type: 'error', text: `Errore durante l'esportazione degli allegati: ${e.message}` });
    } finally {
      setIsExportingUploads(false);
    }
  };

  // Local JSON or SQL Backup Import
  const handleLocalImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isSql = file.name.endsWith('.sql');

    if (isSql) {
      if (dbType !== 'mariadb') {
        setStatusMsg({
          type: 'error',
          text: "Impossibile importare un file SQL se il database attivo non è MariaDB. Seleziona 'MariaDB' nella configurazione sopra e salva prima di ripristinare."
        });
        event.target.value = '';
        return;
      }

      const confirmRestore = window.confirm(
        "ATTENZIONE! Stai per ripristinare l'intero database MariaDB da un file SQL.\n\n" +
        "Tutte le tabelle attuali verranno eliminate e sovrascritte con i dati del file di backup.\n" +
        "Vuoi procedere?"
      );

      if (!confirmRestore) {
        event.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const sqlContent = e.target?.result as string;
          setStatusMsg({ type: 'info', text: "Ripristino database MariaDB in corso..." });

          const response = await fetch('/api/backup/import-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: sqlContent
          });

          const result = await response.json();
          if (response.ok && result.success) {
            // Force sync to load new data from MariaDB to client's localStorage
            await initializeLocalDatabase();
            
            setStatusMsg({
              type: 'success',
              text: "Database MariaDB ripristinato con successo! I dati sono stati aggiornati."
            });

            // Aggiorna statistiche
            const updatedLocalData = exportLocalData();
            setStats({
              quotationsCount: updatedLocalData.quotations?.length || 0,
              clientsCount: updatedLocalData.clients?.length || 0
            });

            if (onBackupSuccess) onBackupSuccess();
          } else {
            throw new Error(result.error || "Errore sconosciuto durante il ripristino del database.");
          }
        } catch (err: any) {
          setStatusMsg({ type: 'error', text: `Errore durante il ripristino: ${err.message}` });
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (!json.quotations && !json.clients && !json.catalog_items) {
            throw new Error('Il file JSON selezionato non sembra contenere un backup valido.');
          }
          
          // Confirm option: merge or overwrite
          const confirmOverwrite = window.confirm(
            "Come desideri importare i dati?\n\n" +
            "Clicca 'OK' per SOVRASCRIVERE interamente i dati attuali con questo backup.\n" +
            "Clicca 'Annulla' per UNIRE i dati del backup a quelli già presenti senza sovrascriverli."
          );
          
          if (confirmOverwrite) {
            importLocalData(json);
            setStatusMsg({ 
              type: 'success', 
              text: 'I dati locali sono stati completamente sovrascritti con il backup caricato.' 
            });
          } else {
            const summary = mergeLocalAndRemote(json);
            setStatusMsg({ 
              type: 'success', 
              text: `Backup unito correttamente! Aggiunti ${summary.addedQuotations} preventivi e ${summary.addedClients} clienti.` 
            });
          }

          // Refresh stats
          const updatedLocalData = exportLocalData();
          setStats({
            quotationsCount: updatedLocalData.quotations?.length || 0,
            clientsCount: updatedLocalData.clients?.length || 0
          });

          if (onBackupSuccess) onBackupSuccess();
        } catch (err: any) {
          setStatusMsg({ type: 'error', text: `Errore durante l'importazione: ${err.message}` });
        }
      };
      reader.readAsText(file);
    }
    // Reset file input
    event.target.value = '';
  };

  // Clear database helper
  const handleClearDatabase = () => {
    if (window.confirm("ATTENZIONE! Questa operazione cancellerà PERMANENTEMENTE tutti i preventivi, i clienti e i prodotti attualmente memorizzati nel browser locale.\n\nSei sicuro di voler procedere?")) {
      const confirmDouble = window.confirm("Confermi di avere un backup o di voler eliminare tutto in modo definitivo?");
      if (confirmDouble) {
        localStorage.removeItem('quotations');
        localStorage.removeItem('clients');
        localStorage.removeItem('catalog_items');
        
        setStats({ quotationsCount: 0, clientsCount: 0 });
        setStatusMsg({ type: 'success', text: 'Tutti i dati locali sono stati cancellati correttamente.' });
        if (onBackupSuccess) onBackupSuccess();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-400">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gestione Salvataggi & Backup</h3>
              <p className="text-[11px] text-gray-400">Esporta e importa i tuoi dati in formato {dbType === 'mariadb' ? 'SQL (MariaDB)' : 'JSON'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Message */}
          {statusMsg.type && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              statusMsg.type === 'success' ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' :
              'bg-rose-950/40 border-rose-800/80 text-rose-300'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle className="shrink-0 mt-0.5 text-emerald-400" size={18} />
              ) : (
                <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={18} />
              )}
              <span className="text-xs font-semibold leading-relaxed">{statusMsg.text}</span>
            </div>
          )}

          {/* Local Stats Box */}
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-850 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Stato Database Locale</span>
              <div className="flex items-center gap-3 text-xs text-gray-300">
                <span className="flex items-center gap-1">
                  <strong className="text-white text-sm font-mono">{stats.quotationsCount}</strong> preventivi
                </span>
                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <strong className="text-white text-sm font-mono">{stats.clientsCount}</strong> anagrafiche
                </span>
              </div>
            </div>
            <div className="p-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-400">
              <Layers size={18} />
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Export */}
            <button
              onClick={handleLocalExport}
              className="flex flex-col items-center justify-center p-5 bg-gray-950/50 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-center space-y-3 group"
            >
              <div className="p-3 bg-blue-950/40 border border-blue-900/60 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                <FileDown size={22} />
              </div>
              <div>
                <span className="block text-xs font-bold text-white">Esporta Dati</span>
                <span className="text-[10px] text-gray-400">
                  {dbType === 'mariadb' ? 'Scarica dump SQL MariaDB' : 'Scarica file JSON di backup'}
                </span>
              </div>
            </button>

            {/* Export Uploads ZIP */}
            <button
              type="button"
              onClick={handleExportUploads}
              disabled={isExportingUploads}
              className="flex flex-col items-center justify-center p-5 bg-gray-950/50 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-center space-y-3 group disabled:opacity-50"
            >
              <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
                {isExportingUploads ? (
                  <RefreshCw size={22} className="animate-spin text-amber-400" />
                ) : (
                  <FolderDown size={22} />
                )}
              </div>
              <div>
                <span className="block text-xs font-bold text-white">Esporta Allegati</span>
                <span className="text-[10px] text-gray-400">Scarica cartella uploads ZIP</span>
              </div>
            </button>

            {/* Import */}
            <label className="flex flex-col items-center justify-center p-5 bg-gray-950/50 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-center space-y-3 group cursor-pointer">
              <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                <FileUp size={22} />
              </div>
              <div>
                <span className="block text-xs font-bold text-white">Ripristina Dati</span>
                <span className="text-[10px] text-gray-400">
                  {dbType === 'mariadb' ? 'Carica file SQL MariaDB' : 'Carica file JSON salvato'}
                </span>
              </div>
              <input 
                type="file" 
                accept={dbType === 'mariadb' ? '.sql' : '.json'} 
                onChange={handleLocalImport} 
                className="hidden" 
                id="import-db-file"
              />
            </label>

            {/* Ricarica / Sincronizza DB */}
            <button
              type="button"
              onClick={handleReloadDatabase}
              disabled={isReloading}
              className="flex flex-col items-center justify-center p-5 bg-gray-950/50 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 rounded-xl transition-all text-center space-y-3 group disabled:opacity-50"
            >
              <div className="p-3 bg-purple-950/40 border border-purple-900/60 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                <RefreshCw size={22} className={isReloading ? "animate-spin text-purple-400" : "text-purple-400"} />
              </div>
              <div>
                <span className="block text-xs font-bold text-white">Ricarica DB</span>
                <span className="text-[10px] text-gray-400">Forza allineamento con MariaDB</span>
              </div>
            </button>
          </div>

          {/* Database di Rete / NAS / MariaDB */}
          <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-950/60 border border-blue-800/80 rounded-lg text-blue-400">
                <Network size={16} />
              </div>
              <div>
                <span className="block text-xs font-bold text-white">Centralizzazione Dati & NAS</span>
                <span className="text-[10px] text-gray-400">Condividi e sincronizza i dati su un percorso comune o database</span>
              </div>
            </div>

            {/* Toggle Engine */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800">
              <button
                type="button"
                onClick={() => setDbType('json')}
                className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all ${
                  dbType === 'json'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                File JSON (Locale o Rete)
              </button>
              <button
                type="button"
                onClick={() => setDbType('mariadb')}
                className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all ${
                  dbType === 'mariadb'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                MariaDB / MySQL (NAS)
              </button>
            </div>

            {dbType === 'json' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] text-gray-400">
                    Percorso file o cartella database personalizzato (es: <code className="text-amber-400 font-mono text-[10px] bg-gray-900 px-1 py-0.5 rounded border border-gray-800">//NAS/condivisa/DB</code> o <code className="text-amber-400 font-mono text-[10px] bg-gray-900 px-1 py-0.5 rounded border border-gray-800">Z:/gestionale/DB</code>):
                  </label>
                  <div className="flex gap-1.5 flex-wrap sm:flex-nowrap">
                    <input
                      type="text"
                      value={inputPath}
                      onChange={(e) => setInputPath(e.target.value)}
                      placeholder="Lascia vuoto per utilizzare la cartella predefinita"
                      className="flex-1 bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-mono placeholder:text-gray-650 min-w-[200px]"
                    />
                    <button
                      type="button"
                      onClick={handleStartBrowsing}
                      className={`font-semibold text-xs px-3 py-2 rounded-lg border transition-all flex items-center gap-1 shrink-0 ${
                        isBrowsingFolders
                          ? 'bg-amber-600 hover:bg-amber-700 border-amber-500 text-white shadow'
                          : 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200'
                      }`}
                    >
                      <FolderOpen size={13} />
                      Sfoglia...
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDbConfig}
                      disabled={configSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                    >
                      {configSaving ? <RefreshCw className="animate-spin" size={13} /> : <Save size={13} />}
                      Salva
                    </button>
                  </div>
                </div>

                {dbConfig && dbConfig.dbType !== 'mariadb' && (
                  <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-850 space-y-1 text-[10px]">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-gray-500 shrink-0">Percorso attivo:</span>
                      <span className="font-mono text-gray-300 break-all text-right">
                        {dbConfig.activePath}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Stato database:</span>
                      <span className={`font-bold ${dbConfig.isCustom ? 'text-amber-400' : 'text-blue-400'}`}>
                        {dbConfig.isCustom ? '🌐 Rete / Personalizzato (NAS)' : '💻 Locale (Cartella App)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-4 space-y-1">
                    <label className="block text-[10px] text-gray-400 font-semibold">IP / Host Server (Synology NAS)</label>
                    <input
                      type="text"
                      value={mariadbConfig.host}
                      onChange={(e) => setMariadbConfig({ ...mariadbConfig, host: e.target.value })}
                      placeholder="es: 192.168.1.100"
                      className="w-full bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[10px] text-gray-400 font-semibold">Porta</label>
                    <input
                      type="number"
                      value={mariadbConfig.port}
                      onChange={(e) => setMariadbConfig({ ...mariadbConfig, port: parseInt(e.target.value) || 3306 })}
                      placeholder="3306"
                      className="w-full bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="col-span-3 space-y-1">
                    <label className="block text-[10px] text-gray-400 font-semibold">Utente DB</label>
                    <input
                      type="text"
                      value={mariadbConfig.user}
                      onChange={(e) => setMariadbConfig({ ...mariadbConfig, user: e.target.value })}
                      placeholder="root"
                      className="w-full bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="block text-[10px] text-gray-400 font-semibold">Password</label>
                    <input
                      type="password"
                      value={mariadbConfig.password}
                      onChange={(e) => setMariadbConfig({ ...mariadbConfig, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="col-span-6 space-y-1">
                    <label className="block text-[10px] text-gray-400 font-semibold">Nome Database (deve essere già creato in MariaDB)</label>
                    <input
                      type="text"
                      value={mariadbConfig.database}
                      onChange={(e) => setMariadbConfig({ ...mariadbConfig, database: e.target.value })}
                      placeholder="preventivi_db"
                      className="w-full bg-gray-900 border border-gray-750 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Test Connection Result */}
                {testResult.type && (
                  <div className={`p-2 rounded-lg border text-[10px] flex items-center gap-2 ${
                    testResult.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  }`}>
                    {testResult.type === 'success' ? (
                      <CheckCircle className="shrink-0 text-emerald-400" size={13} />
                    ) : (
                      <AlertTriangle className="shrink-0 text-rose-400" size={13} />
                    )}
                    <span className="truncate">{testResult.message}</span>
                  </div>
                )}

                {/* DB Actions */}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleTestMariaDb}
                    disabled={testingConnection}
                    className="bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    {testingConnection ? <RefreshCw className="animate-spin" size={12} /> : null}
                    Testa Connessione
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDbConfig}
                    disabled={configSaving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                  >
                    {configSaving ? <RefreshCw className="animate-spin" size={12} /> : <Save size={12} />}
                    Salva e Attiva
                  </button>
                </div>
              </div>
            )}

            {/* General migration toggle */}
            <div className="pt-2 border-t border-gray-850 flex items-center gap-2">
              <input
                type="checkbox"
                id="copyExisting"
                checked={copyExisting}
                onChange={(e) => setCopyExisting(e.target.checked)}
                className="rounded border-gray-700 text-blue-650 bg-gray-900 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="copyExisting" className="text-gray-400 cursor-pointer text-[10px] leading-tight select-none">
                Migra/copia i dati locali attuali sulla destinazione configurata (se non esistono già dati)
              </label>
            </div>
          </div>

          {/* Informational advice */}
          <div className="bg-blue-950/20 p-3.5 rounded-xl border border-blue-900/30 text-xs text-blue-400 flex gap-2.5 leading-relaxed">
            <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
            <div>
              <p className="font-semibold">Perché fare un backup locale?</p>
              <p className="text-[11px] text-blue-300/80 mt-1">
                L'applicazione memorizza i preventivi nella cache del browser. Scaricare periodicamente il backup ti garantisce di non perdere mai i dati in caso di pulizia del browser o cambi dispositivo.
              </p>
            </div>
          </div>

          {/* Diagnostic Tool */}
          <div className="bg-gray-950/40 p-4 rounded-xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-950/60 border border-purple-800/80 rounded-lg text-purple-400">
                  <Database size={16} />
                </div>
                <div>
                  <span className="block text-xs font-bold text-white">Diagnostica Schema Database</span>
                  <span className="text-[10px] text-gray-400">Verifica la consistenza dei preventivi e dello schema JSON</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <RefreshCw size={11} />
                Esegui Test
              </button>
            </div>

            {diagnosticResult && diagnosticResult.run && (
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                diagnosticResult.isValid 
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' 
                  : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
              }`}>
                {diagnosticResult.isValid ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="shrink-0 text-emerald-400" size={14} />
                    <span>Nessuna anomalia rilevata! Tutti i preventivi e i dati sono conformi allo schema atteso.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-400">
                      <AlertTriangle className="shrink-0" size={14} />
                      <span>Rilevate {diagnosticResult.errors.length} anomalie nello schema:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] font-mono max-h-40 overflow-y-auto bg-black/45 p-2 rounded border border-rose-950">
                      {diagnosticResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-gray-400">
                      Le anomalie riportate sopra potrebbero causare fallimenti durante le operazioni di salvataggio o scrittura nel database remoto.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-950/40 border-t border-gray-800/80 flex items-center justify-between">
          <button
            onClick={handleClearDatabase}
            className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors py-1.5 px-2 rounded hover:bg-red-950/10"
            title="Svuota l'intero database locale"
          >
            <Trash2 size={13} />
            Svuota Archivio
          </button>
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-750 transition-colors rounded-lg shadow-sm"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Finestra Popup Esploratore Cartelle (Centered Modal Popup Window) */}
      {isBrowsingFolders && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header del Popup */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-950/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-950/60 border border-amber-900/60 rounded-xl text-amber-400">
                  <FolderOpen size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Sfoglia Cartelle del Server / PC</h4>
                  <p className="text-[10px] text-gray-400">Naviga e seleziona il percorso per il database (Locale o NAS)</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsBrowsingFolders(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenuto del Popup */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Scorciatoie Unità */}
              {browseDrives.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Unità di Rete e Locali Rilevate:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {browseDrives.map((drv) => (
                      <button
                        key={drv}
                        type="button"
                        onClick={() => handleLoadFolder(drv)}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                          browseCurrentPath.startsWith(drv) && drv !== '/'
                            ? 'bg-blue-950 border-blue-800 text-blue-300'
                            : 'bg-gray-950/80 hover:bg-gray-800 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Home size={10} className="text-gray-500" />
                        {drv}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Percorso Corrente modificabile */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-sans">Percorso Corrente Selezionato:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={browseCurrentPath}
                    onChange={(e) => setBrowseCurrentPath(e.target.value)}
                    className="flex-1 bg-gray-950 border border-gray-800 text-xs text-amber-400 rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleLoadFolder(browseCurrentPath)}
                    className="bg-gray-850 hover:bg-gray-800 border border-gray-750 text-white px-3 py-2 rounded-lg text-xs font-semibold"
                  >
                    Vai
                  </button>
                </div>
              </div>

              {/* Lista cartelle navigabili */}
              <div className="bg-gray-950 rounded-xl border border-gray-800 max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                {browseLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 text-[11px] text-gray-400 gap-2.5">
                    <RefreshCw className="animate-spin text-blue-500" size={16} />
                    <span>Caricamento elenco cartelle...</span>
                  </div>
                ) : browseError ? (
                  <div className="p-3 text-[11px] text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg space-y-2">
                    <p className="font-semibold">Impossibile accedere a questo percorso:</p>
                    <p className="font-mono text-[10px] bg-gray-950/60 p-1.5 rounded border border-red-950 text-gray-300 break-all">{browseError}</p>
                    <p className="text-[10px] text-gray-400 leading-normal">Se stai provando ad accedere ad un NAS o percorso di rete, assicurati che sia correttamente montato sul computer e che l'applicazione abbia i permessi di lettura/scrittura.</p>
                  </div>
                ) : (
                  <>
                    {/* Tasto torna su */}
                    {browseParentPath && (
                      <button
                        type="button"
                        onClick={() => handleLoadFolder(browseParentPath)}
                        className="w-full flex items-center gap-2 text-xs text-blue-400 hover:bg-gray-900/80 px-2.5 py-1.5 rounded-lg transition-colors text-left font-semibold"
                      >
                        <CornerLeftUp size={14} className="text-blue-500" />
                        <span>.. (Cartella superiore)</span>
                      </button>
                    )}

                    {browseFolders.length === 0 ? (
                      <div className="text-center py-10 text-xs text-gray-500 italic">
                        Nessuna cartella accessibile in questo percorso.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {browseFolders.map((fld) => {
                          const fullPath = browseCurrentPath.endsWith('/') || browseCurrentPath.endsWith('\\')
                            ? browseCurrentPath + fld
                            : browseCurrentPath + (browseCurrentPath.includes('\\') ? '\\' : '/') + fld;
                          return (
                            <button
                              key={fld}
                              type="button"
                              onClick={() => handleLoadFolder(fullPath)}
                              className="flex items-center gap-2 text-xs text-gray-300 hover:text-white hover:bg-gray-900 px-2.5 py-2 rounded-lg transition-all text-left truncate border border-transparent hover:border-gray-800"
                            >
                              <Folder size={14} className="text-amber-500 shrink-0" />
                              <span className="truncate">{fld}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer del Popup */}
            <div className="px-5 py-4 bg-gray-950/60 border-t border-gray-800/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBrowsingFolders(false)}
                className="bg-gray-800 hover:bg-gray-755 border border-gray-750 text-gray-300 font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSelectBrowsedFolder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle size={14} />
                Seleziona cartella
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
