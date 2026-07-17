/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Home as HomeIcon, Users, FileText, Settings, RefreshCw, Power, AlertTriangle, CheckCircle, Download, History, Database, Github, Zap, Lock, LockOpen, Wifi, WifiOff, Globe, HardDrive, Brain, Terminal, FileCode, Sliders, Trash2 } from 'lucide-react';
import Home from './components/Home';
import QuotationManager from './components/QuotationManager';
import Anagrafiche from './components/Anagrafiche';
import InvoiceManager from './components/InvoiceManager';
import LogViewer from './components/LogViewer';
import LaserProcessing from './components/LaserProcessing';
import MaterialManager from './components/MaterialManager';
import BackupModal from './components/BackupModal';
import GitHubUpdatePopup from './components/GitHubUpdatePopup';
import ChangelogModal from './components/ChangelogModal';
import GitHubUpdateModal from './components/GitHubUpdateModal';
import { getGitHubConfig, exportLocalData, checkSoftwareUpdate, CURRENT_VERSION } from './lib/githubSync';
import { initializeLocalDatabase, syncWithServer, getDbStatus, safeGetItem, safeSetItem, getUsers } from './lib/db';
import { User } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'quotations' | 'anagrafiche' | 'laser' | 'ai' | 'invoices' | 'materiali'>('home');
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [shouldCreateQuotation, setShouldCreateQuotation] = useState(false);
  const [selectedQuotationToEdit, setSelectedQuotationToEdit] = useState<any | null>(null);
  const [selectedClientIdForAnagrafiche, setSelectedClientIdForAnagrafiche] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGitHubUpdateModalOpen, setIsGitHubUpdateModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdatePopupOpen, setIsUpdatePopupOpen] = useState(false);
  const [remoteSoftwareVersion, setRemoteSoftwareVersion] = useState<string>('');
  
  // Track if user has opened the changelog
  const [hasOpenedChangelog, setHasOpenedChangelog] = useState(() => {
    return safeGetItem('has_opened_changelog_v136') === 'true';
  });

  // Unique client session ID on mount for heartbeat tracking
  const [clientId] = useState(() => {
    return 'client_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!currentUser;

  // Heartbeat mechanism to detect tab / browser closure and auto shutdown
  useEffect(() => {
    const sendHeartbeat = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      }).catch(() => {});
    };

    // Send first heartbeat immediately on mount
    sendHeartbeat();

    // Send heartbeat every 4 seconds
    const interval = setInterval(sendHeartbeat, 4000);

    // Notify server immediately on window unload
    const handleUnload = () => {
      const payload = JSON.stringify({ clientId });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/client-unload', payload);
        } else {
          fetch('/api/client-unload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch (e) {
        // Fallback fetch
        fetch('/api/client-unload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [clientId]);

  // Shutdown states
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [shutdownProgress, setShutdownProgress] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');

  // Database initialization states
  const [isDbInitializing, setIsDbInitializing] = useState(true);
  const [dbStatus, setDbStatus] = useState(() => getDbStatus());

  useEffect(() => {
    const handleStatusUpdate = () => {
      setDbStatus(getDbStatus());
    };
    window.addEventListener('database-status-updated', handleStatusUpdate);
    return () => {
      window.removeEventListener('database-status-updated', handleStatusUpdate);
    };
  }, []);

  // Periodic background synchronization every 10 seconds to sync changes with other PCs
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await syncWithServer(true); // force to bypass local cooldown
      } catch (err) {
        console.warn("Sincronizzazione in background fallita:", err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize and load the database file on startup
  useEffect(() => {
    async function initDb() {
      try {
        await initializeLocalDatabase();
      } catch (e) {
        console.error("Errore durante la sincronizzazione iniziale del database su file:", e);
      } finally {
        setIsDbInitializing(false);
      }
    }
    initDb();
  }, []);

  useEffect(() => {
    const handleGoToNewClient = () => {
      setActiveTab('anagrafiche');
    };
    window.addEventListener('go-to-new-client-form', handleGoToNewClient);
    return () => {
      window.removeEventListener('go-to-new-client-form', handleGoToNewClient);
    };
  }, []);

  const handleShutdown = async () => {
    setShutdownProgress('sending');
    try {
      const response = await fetch('/api/shutdown', { method: 'POST' });
      if (response.ok) {
        setShutdownProgress('success');
        setIsShuttingDown(true);
        setTimeout(() => {
          try {
            window.close();
          } catch (err) {
            console.log("Could not auto-close window:", err);
          }
        }, 3000);
      } else {
        setShutdownProgress('failed');
      }
    } catch (e) {
      // If the connection drops instantly during shutdown, it means the server stopped successfully!
      setShutdownProgress('success');
      setIsShuttingDown(true);
      setTimeout(() => {
        try {
          window.close();
        } catch (err) {
          console.log("Could not auto-close window:", err);
        }
      }, 3000);
    }
  };

  // Check for software updates on GitHub on app load
  useEffect(() => {
    async function checkForUpdates() {
      const config = getGitHubConfig();
      if (config.token && config.repo) {
        setIsCheckingUpdate(true);
        try {
          const result = await checkSoftwareUpdate(config);
          if (result.success && result.hasUpdate) {
            // Only prompt if they haven't ignored this exact version in this browser session/storage
            const lastIgnored = safeGetItem('last_ignored_software_version');
            if (lastIgnored !== result.remoteVersion) {
              setRemoteSoftwareVersion(result.remoteVersion);
              setIsUpdatePopupOpen(true);
            }
          }
        } catch (e) {
          console.error('Failed to check for GitHub updates:', e);
        } finally {
          setIsCheckingUpdate(false);
        }
      }
    }
    checkForUpdates();
  }, [refreshTrigger]);

  const navItems: {id: typeof activeTab, label: string, icon: React.ReactElement}[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon size={20} /> },
    ...(currentUser?.role === 'ADMIN' ? [
      { id: 'quotations', label: 'Preventivi', icon: <FileText size={20} /> },
      { id: 'anagrafiche', label: 'Anagrafiche', icon: <Users size={20} /> },
      { id: 'invoices', label: 'Fatture', icon: <FileCode size={20} /> }
    ] : []),
    { id: 'laser', label: 'Lavorazione Laser', icon: <Zap size={20} /> },
    { id: 'materiali', label: 'Materiali', icon: <Sliders size={20} /> },
  ];

  const handleCreateQuotation = () => {
    setSelectedQuotationToEdit(null);
    setShouldCreateQuotation(true);
    setActiveTab('quotations');
  };

  const handleEditQuotation = (q: any) => {
    setSelectedQuotationToEdit(q);
    setShouldCreateQuotation(true);
    setActiveTab('quotations');
  };

  const handleUpdateSoftware = () => {
    setIsUpdatePopupOpen(false);
    setIsGitHubUpdateModalOpen(true);
  };

  const handleCloseUpdatePopup = () => {
    // Save the version as ignored to avoid nagging on future page reloads
    if (remoteSoftwareVersion) {
      safeSetItem('last_ignored_software_version', remoteSoftwareVersion);
    }
    setIsUpdatePopupOpen(false);
  };

  if (isDbInitializing) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm animate-in fade-in duration-500">
          <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
          <h2 className="text-xl font-bold mb-2">Caricamento in corso...</h2>
          <p className="text-sm text-gray-400">
            Sincronizzazione dei dati con il file <code className="font-mono text-xs bg-gray-800 text-amber-400 px-1.5 py-0.5 rounded border border-gray-700">dati_gestionale.json</code> in corso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 text-gray-100">
      <header className="sticky top-0 bg-gray-900 border-b border-gray-700 z-10 shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-700 rounded-lg text-white animate-in zoom-in-50 duration-300">
              <FileText size={24} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">Gestionale</h1>
                <span className="bg-gray-800 text-gray-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-700 select-none">
                  v{CURRENT_VERSION}
                </span>
                {remoteSoftwareVersion && (
                  <button
                    onClick={() => setIsGitHubUpdateModalOpen(true)}
                    className="inline-flex items-center gap-1 bg-blue-950/80 border border-blue-700 hover:border-blue-500 text-blue-400 hover:text-blue-300 text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer animate-pulse transition-all shrink-0"
                    title="Nuova versione software disponibile su GitHub! Clicca per visualizzare."
                  >
                    Aggiornamento Disponibile (v{remoteSoftwareVersion})
                  </button>
                )}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">Gestione Offline & Backup</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Indicatore Stato Database */}
            <div 
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-semibold select-none ${
                dbStatus.dbType === 'mariadb'
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400'
                  : dbStatus.dbType === 'mariadb-fallback'
                  ? 'bg-amber-950/30 border-amber-800 text-amber-400'
                  : 'bg-blue-950/30 border-blue-800 text-blue-400'
              }`}
              title={
                dbStatus.dbType === 'mariadb'
                  ? 'Connesso al database MariaDB (Synology NAS)'
                  : dbStatus.dbType === 'mariadb-fallback'
                  ? `MariaDB non raggiungibile (${dbStatus.fallbackReason || 'connessione scaduta'}). Ricaduta automatica su database JSON locale.`
                  : 'Database configurato su file JSON locale'
              }
            >
              {/* Icone Colorate per Stato Connessione */}
              <div className="flex items-center gap-1.5 border-r border-current/20 pr-2 mr-0.5">
                {dbStatus.dbType === 'mariadb' ? (
                  <>
                    <Wifi size={13} className="text-emerald-400 animate-pulse" title="Rete/NAS: Connesso" />
                    <Database size={13} className="text-emerald-400 animate-pulse" title="Database MariaDB: Online" />
                  </>
                ) : dbStatus.dbType === 'mariadb-fallback' ? (
                  <>
                    <WifiOff size={13} className="text-rose-500" title="Rete/NAS: Disconnesso" />
                    <Database size={13} className="text-amber-500" title="Database MariaDB: Offline" />
                    <HardDrive size={13} className="text-emerald-400" title="Backup Locale: Attivo" />
                  </>
                ) : (
                  <>
                    <Globe size={13} className="text-blue-400" title="Modalità Offline" />
                    <Database size={13} className="text-blue-400" title="Database Locale: Attivo" />
                  </>
                )}
              </div>

              <span className="hidden sm:inline font-mono text-[10px] tracking-wider uppercase">
                {dbStatus.dbType === 'mariadb'
                  ? 'MariaDB NAS'
                  : dbStatus.dbType === 'mariadb-fallback'
                  ? 'Backup Locale (Offline)'
                  : 'Database Locale'}
              </span>
            </div>

            {/* Accedi / Nome Utente prima del pulsante spegni server */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 font-medium bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg">
                  {currentUser.username} ({currentUser.role})
                </span>
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    sessionStorage.removeItem('currentUser');
                    setActiveTab('home');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-rose-400 hover:bg-rose-950/20 border border-gray-700 hover:border-rose-900 rounded-lg transition-all cursor-pointer"
                  title="Disconnetti Sessione"
                >
                  <LockOpen size={14} />
                  <span>Esci</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveTab('quotations');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 border border-blue-900 hover:border-blue-700 rounded-lg transition-all cursor-pointer"
                title="Accedi"
              >
                <Lock size={14} />
                <span>Accedi</span>
              </button>
            )}

            {/* Spegni Server Button */}
            <button
              onClick={() => setShowShutdownConfirm(true)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-rose-950/40 border border-gray-700 hover:border-rose-900 text-gray-400 hover:text-rose-400 transition-all flex items-center justify-center"
              title="Spegni Server Locale (Porta 3000)"
            >
              <Power size={18} />
            </button>
            
            {/* Log Viewer Button */}
            <button
              onClick={() => setIsLogViewerOpen(!isLogViewerOpen)}
              className={`p-2 rounded-lg border border-gray-700 transition-all flex items-center justify-center ${isLogViewerOpen ? 'bg-gray-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'}`}
              title="Log di Sistema"
            >
              <Terminal size={18} />
            </button>



            {/* Backup & Database button */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-all flex items-center justify-center"
              title="Gestione Backup & Archivio"
            >
              <Database size={18} />
            </button>

            {/* GitHub Updates Center button */}
            <button
              onClick={() => setIsGitHubUpdateModalOpen(true)}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-blue-400 transition-all flex items-center justify-center relative"
              title="Centro Aggiornamenti GitHub"
            >
              <Github size={18} />
              {remoteSoftwareVersion && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}
            </button>

            <div className="h-6 w-[1px] bg-gray-700 mx-1"></div>

            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'quotations') {
                    setShouldCreateQuotation(false);
                    setSelectedQuotationToEdit(null);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === item.id 
                    ? 'bg-blue-800 text-white' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
        <div className="animate-in fade-in duration-500">
          {activeTab === 'home' && (
            <Home 
              key={`home-${refreshTrigger}`}
              setActiveTab={setActiveTab} 
              onNewQuotation={handleCreateQuotation} 
              onEditQuotation={handleEditQuotation}
              onOpenSync={() => setIsBackupModalOpen(true)}
              onSelectClient={(clientId) => {
                setSelectedClientIdForAnagrafiche(clientId);
                setActiveTab('anagrafiche');
              }}
              currentUser={currentUser}
            />
          )}
          {(activeTab === 'quotations' || activeTab === 'anagrafiche' || activeTab === 'invoices') && (!isAuthenticated || currentUser?.role !== 'ADMIN') ? (
            <Login onLoginSuccess={(user: User) => {
              setCurrentUser(user);
              sessionStorage.setItem('currentUser', JSON.stringify(user));
              setActiveTab('home');
            }} />
          ) : (
            <>
              {activeTab === 'quotations' && (
                <QuotationManager 
                  key={`quotations-${refreshTrigger}`}
                  setActiveTab={setActiveTab} 
                  initialCreating={shouldCreateQuotation}
                  initialEditingQuotation={selectedQuotationToEdit}
                  onClearInitialEditing={() => {
                    setShouldCreateQuotation(false);
                    setSelectedQuotationToEdit(null);
                  }}
                />
              )}
              {activeTab === 'anagrafiche' && (
                <Anagrafiche 
                  key={`anagrafiche-${refreshTrigger}`} 
                  setActiveTab={setActiveTab} 
                  selectedClientId={selectedClientIdForAnagrafiche}
                  onClearSelectedClient={() => setSelectedClientIdForAnagrafiche(null)}
                />
              )}
              {activeTab === 'invoices' && (
                <InvoiceManager 
                  key={`invoices-${refreshTrigger}`} 
                  setActiveTab={setActiveTab}
                />
              )}
            </>
          )}
          {activeTab === 'laser' && <LaserProcessing key={`laser-${refreshTrigger}`} currentUser={currentUser} />}
          {activeTab === 'materiali' && <MaterialManager key={`materiali-${refreshTrigger}`} setActiveTab={setActiveTab} />}
        </div>
      </main>

      <BackupModal 
        isOpen={isBackupModalOpen} 
        onClose={() => setIsBackupModalOpen(false)} 
        onBackupSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />

      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />

      <GitHubUpdatePopup
        isOpen={isUpdatePopupOpen}
        localVersion={CURRENT_VERSION}
        remoteVersion={remoteSoftwareVersion}
        onClose={handleCloseUpdatePopup}
        onOpenChangelog={() => setIsChangelogOpen(true)}
        onUpdate={handleUpdateSoftware}
      />

      <GitHubUpdateModal 
        isOpen={isGitHubUpdateModalOpen}
        onClose={() => setIsGitHubUpdateModalOpen(false)}
        onUpdateSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />

      {/* Shutdown Confirmation Modal */}
      {showShutdownConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-950/50 border border-rose-900 rounded-lg">
                <Power size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Spegni Server Locale?</h3>
            </div>
            
            <p className="text-sm text-gray-300 leading-relaxed">
              Questa azione interromperà il server Node.js locale in esecuzione sulla porta <strong className="text-white">3000</strong>. La porta verrà immediatamente liberata, prevenendo futuri errori di tipo <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300 font-mono text-xs">EADDRINUSE</code>.
            </p>
            
            <p className="text-xs text-amber-400 bg-amber-950/20 p-3 rounded-lg border border-amber-900/30 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Per riutilizzare l'applicazione in seguito, dovrai avviarla di nuovo dal terminale con <code className="bg-amber-950/40 px-1 py-0.5 rounded text-amber-300 font-mono text-[10px]">npm run dev</code>.
              </span>
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowShutdownConfirm(false);
                  setShutdownProgress('idle');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors hover:bg-gray-800 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={handleShutdown}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                disabled={shutdownProgress === 'sending'}
              >
                {shutdownProgress === 'sending' ? 'Spegnimento...' : 'Sì, Spegni Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen blocker once server is successfully shut down */}
      {isShuttingDown && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-gray-950 text-gray-100 space-y-6">
          <div className="p-4 bg-emerald-950/50 border border-emerald-800 text-emerald-400 rounded-full animate-bounce">
            <CheckCircle size={48} />
          </div>
          
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-2xl font-bold text-white">Server Spento con Successo!</h2>
            <p className="text-gray-400 text-sm">
              La porta <strong className="text-white">3000</strong> è stata liberata e l'applicazione locale è stata arrestata correttamente.
            </p>
            <p className="text-xs text-gray-500 pt-4">
              Puoi chiudere in sicurezza questa scheda del browser.
            </p>
          </div>

          <button
            onClick={() => {
              try {
                window.close();
              } catch (e) {
                console.log(e);
              }
            }}
            className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium rounded-xl text-sm transition-colors"
          >
            Chiudi Finestra
          </button>
        </div>
      )}
    </div>
  );
}

function Login({ onLoginSuccess }: { onLoginSuccess: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const usersList = await getUsers();
      const matchedUser = usersList.find(u => u.username === username && u.password === password);
      if (matchedUser) {
        onLoginSuccess(matchedUser);
      } else {
        setError('Credenziali non valide. Riprova.');
      }
    } catch (err) {
      console.error(err);
      setError('Errore durante l\'accesso. Riprova.');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="p-3 bg-blue-950 border border-blue-800 rounded-2xl text-blue-400 mb-3">
          <Lock size={28} />
        </div>
        <h2 className="text-xl font-bold text-white">Area Riservata</h2>
        <p className="text-xs text-gray-400 mt-1">Le sezioni Preventivi e Anagrafiche sono protette da login.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-400">Utente</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-sans text-white placeholder-gray-600"
            placeholder="Inserisci username"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-sans text-white placeholder-gray-600"
            placeholder="Inserisci password"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          Accedi
        </button>
      </form>
    </div>
  );
}
