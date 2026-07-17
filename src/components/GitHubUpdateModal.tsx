import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Github, 
  ArrowUpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  PlusCircle, 
  MinusCircle, 
  Edit3, 
  ChevronRight,
  Info,
  Calendar,
  Lock,
  GitCommit,
  Eye,
  EyeOff,
  Save
} from 'lucide-react';
import { getGitHubConfig, saveGitHubConfig, CURRENT_VERSION } from '../lib/githubSync';

interface FileDiffItem {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export default function GitHubUpdateModal({ isOpen, onClose, onUpdateSuccess }: Props) {
  const [repo, setRepo] = useState('solinonio/Gestionale-Preventivi');
  const [token, setToken] = useState('');
  const [branch, setBranch] = useState('main');
  const [showToken, setShowToken] = useState(false);
  const [configSavedFeedback, setConfigSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [localVersion, setLocalVersion] = useState(CURRENT_VERSION);
  const [remoteVersion, setRemoteVersion] = useState('');
  const [fileDiffs, setFileDiffs] = useState<FileDiffItem[]>([]);
  const [checkedForDiffs, setCheckedForDiffs] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [updateProgress, setUpdateProgress] = useState(0);
  const [currentUpdatingFile, setCurrentUpdatingFile] = useState('');

  // Load configured values on mount
  useEffect(() => {
    if (isOpen) {
      const config = getGitHubConfig();
      if (config.repo) {
        setRepo(config.repo);
      }
      if (config.token) {
        setToken(config.token);
      }
      if (config.branch) {
        setBranch(config.branch);
      }
      
      // Reset states
      setFileDiffs([]);
      setCheckedForDiffs(false);
      setErrorMessage('');
      setSuccessMessage('');
      setRemoteVersion('');
    }
  }, [isOpen]);

  const handleSaveConfig = () => {
    try {
      const config = getGitHubConfig();
      saveGitHubConfig({
        ...config,
        repo,
        token,
        branch
      });
      setConfigSavedFeedback(true);
      setTimeout(() => {
        setConfigSavedFeedback(false);
      }, 2500);
    } catch (err: any) {
      setErrorMessage(`Impossibile salvare la configurazione: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  const handleCheckDiff = async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setCheckedForDiffs(false);
    try {
      const response = await fetch('/api/check-software-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, token, branch })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Impossibile connettersi o confrontare le versioni.');
      }

      setLocalVersion(resData.localVersion);
      setRemoteVersion(resData.remoteVersion);
      setFileDiffs(resData.fileDiffs || []);
      setCheckedForDiffs(true);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (fileDiffs.length === 0) {
      setSuccessMessage('L\'applicazione è già all\'ultima versione su GitHub! Nessuna modifica da apportare.');
      return;
    }

    const confirmUpdate = window.confirm(
      `Confermi l'aggiornamento software di ${fileDiffs.length} file modificati?\n\n` +
      `Questo aggiornerà l'applicazione alla versione v${remoteVersion}.\n` +
      `Tutti i tuoi dati e preventivi sono al sicuro e non verranno toccati.`
    );

    if (!confirmUpdate) return;

    setUpdating(true);
    setErrorMessage('');
    setSuccessMessage('');
    setUpdateProgress(0);

    try {
      // We simulate real-time progress steps for our UI while requesting the server
      const progressSteps = Math.ceil(fileDiffs.length / 5);
      let stepCounter = 0;
      
      const interval = setInterval(() => {
        if (stepCounter < fileDiffs.length) {
          setCurrentUpdatingFile(fileDiffs[stepCounter].path);
          setUpdateProgress(Math.floor((stepCounter / fileDiffs.length) * 100));
          stepCounter++;
        } else {
          clearInterval(interval);
        }
      }, 100);

      const response = await fetch('/api/apply-software-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, token, branch, fileDiffs })
      });

      clearInterval(interval);
      const resData = await response.json();
      
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Impossibile applicare gli aggiornamenti.');
      }

      setUpdateProgress(100);
      setCurrentUpdatingFile('Aggiornamento completato con successo!');
      
      setSuccessMessage(
        `Applicazione aggiornata correttamente a v${remoteVersion}! Ricaricamento dell'applicazione in corso...`
      );

      // Trigger hot-reload in 1.8s
      setTimeout(() => {
        if (onUpdateSuccess) onUpdateSuccess();
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      setErrorMessage(`Errore durante l'applicazione: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const addedFiles = fileDiffs.filter(f => f.status === 'added');
  const modifiedFiles = fileDiffs.filter(f => f.status === 'modified');
  const deletedFiles = fileDiffs.filter(f => f.status === 'deleted');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-950/60 border border-blue-800/80 rounded-xl text-blue-400">
              <Github size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Aggiornamento Software da GitHub</h3>
              <p className="text-[11px] text-gray-400">Verifica, confronta ed esegui il pull dei file modificati</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={updating}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                   {/* Repository Target Config */}
          <div className="bg-gray-950/50 p-4 border border-gray-800 rounded-xl space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Repository GitHub</label>
                <div className="relative">
                  <Github size={14} className="absolute left-3 top-2.5 text-gray-500" />
                  <input 
                    type="text"
                    value={repo}
                    onChange={(e) => setRepo(e.target.value)}
                    disabled={updating}
                    placeholder="utente/repo"
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Branch</label>
                <input 
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={updating}
                  placeholder="main"
                  className="w-full px-3 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1 block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <Lock size={10} className="text-gray-500" />
                    Token Personale di Accesso (Opzionale)
                  </label>
                  <span className="text-[9px] text-gray-500 italic">Necessario solo se il repo è Privato</span>
                </div>
                <div className="relative">
                  <input 
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={updating}
                    placeholder="Inserisci il token se il repository è privato..."
                    className="w-full pl-3 pr-10 py-1.5 text-xs bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                  />
                  {token && (
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded transition-colors"
                      title={showToken ? "Nascondi Token" : "Mostra Token"}
                    >
                      {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save Config action bar */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-800/40">
              <div className="flex-1">
                {configSavedFeedback && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 animate-fade-in">
                    <CheckCircle2 size={11} /> Configurazione salvata!
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white border border-gray-700/60 text-[10px] font-bold transition-all disabled:opacity-50"
              >
                <Save size={11} />
                Salva Configurazione
              </button>
            </div>
          </div>

          {/* Action to trigger check */}
          {!checkedForDiffs && !loading && (
            <div className="flex justify-center py-2">
              <button
                onClick={handleCheckDiff}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs text-white transition-all hover:shadow-lg hover:shadow-blue-900/20"
              >
                <RefreshCw size={14} />
                Confronta Versione Locale e Remota
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <RefreshCw className="animate-spin text-blue-400" size={32} />
              <p className="text-xs text-gray-400">Connessione a GitHub e calcolo delle differenze locali...</p>
            </div>
          )}

          {/* Error and Success States */}
          {errorMessage && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
              <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={16} />
              <div className="space-y-1">
                <p className="font-bold">Si è verificato un errore:</p>
                <p className="text-rose-400/90 leading-relaxed font-mono">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-xl flex items-start gap-3 text-emerald-300 text-xs">
              <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-400" size={16} />
              <div className="space-y-1">
                <p className="font-bold">Successo:</p>
                <p className="text-emerald-400/90 leading-relaxed">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Active Update Progress Screen */}
          {updating && (
            <div className="bg-gray-950/60 border border-gray-800 p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Applicazione modifiche su disco...</h4>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[400px]">
                    {currentUpdatingFile || 'Avvio installazione...'}
                  </p>
                </div>
                <span className="text-sm font-black text-blue-400 font-mono">{updateProgress}%</span>
              </div>
              <div className="w-full bg-gray-900 border border-gray-800 rounded-full h-3 p-0.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Diff comparison results */}
          {checkedForDiffs && !loading && (
            <div className="space-y-4 animate-fade-in">
              {/* Stats Summary Line */}
              <div className="flex items-center justify-between text-[11px] bg-gray-950/40 px-4 py-2.5 rounded-lg border border-gray-850">
                <span className="text-gray-400 font-semibold uppercase">Differenze Rilevate ({fileDiffs.length}):</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <PlusCircle size={12} /> {addedFiles.length} Nuovi
                  </span>
                  <span className="text-gray-700">•</span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Edit3 size={12} /> {modifiedFiles.length} Modificati
                  </span>
                  <span className="text-gray-700">•</span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <MinusCircle size={12} /> {deletedFiles.length} Eliminati
                  </span>
                </div>
              </div>

              {/* Detailed File List */}
              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-950/60 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Elenco File Modificati</span>
                  <span className="text-[9px] text-gray-500">In base all'analisi dei Git SHA-1</span>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-gray-850">
                  {fileDiffs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500 space-y-1">
                      <CheckCircle2 className="mx-auto text-emerald-500/80 mb-2" size={24} />
                      <p className="text-gray-300 font-semibold">Tutti i file sono sincronizzati!</p>
                      <p className="text-[11px]">Nessuna modifica rilevata rispetto al codice su GitHub.</p>
                    </div>
                  ) : (
                    fileDiffs.map((file) => (
                      <div key={file.path} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-850/40 text-xs transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCode size={14} className="text-gray-500 shrink-0" />
                          <span className="font-mono text-[11px] truncate text-gray-300" title={file.path}>
                            {file.path}
                          </span>
                        </div>

                        {/* Status Label */}
                        {file.status === 'added' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-950/50 border border-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-bold">
                            <PlusCircle size={10} /> Caricato / Nuovo
                          </span>
                        )}
                        {file.status === 'modified' && (
                          <span className="inline-flex items-center gap-1 bg-amber-950/50 border border-amber-900/60 text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold">
                            <Edit3 size={10} /> Modificato
                          </span>
                        )}
                        {file.status === 'deleted' && (
                          <span className="inline-flex items-center gap-1 bg-rose-950/50 border border-rose-900/60 text-rose-400 px-2 py-0.5 rounded text-[9px] font-bold">
                            <MinusCircle size={10} /> Eliminato
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Instructions Info Alert */}
              <div className="bg-blue-950/15 border border-blue-900/30 p-3.5 rounded-xl text-[11px] text-blue-300 flex gap-2.5 leading-relaxed">
                <Info size={16} className="shrink-0 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-blue-200">Come funziona l'aggiornamento?</p>
                  <p className="text-blue-300/80">
                    Il sistema scarica e installa i file indicati nell'elenco soprastante sovrascrivendo unicamente il codice del software. I preventivi salvati sono memorizzati in una parte protetta e non verranno alterati.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-950/40 border-t border-gray-800 flex items-center justify-between shrink-0">
          <div>
            {checkedForDiffs && !loading && fileDiffs.length > 0 && (
              <button
                onClick={handleCheckDiff}
                disabled={updating}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} />
                Rianalizza
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={updating}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-750 transition-colors rounded-lg disabled:opacity-50"
            >
              Annulla
            </button>

            {checkedForDiffs && !loading && fileDiffs.length > 0 && (
              <button
                onClick={handleApplyUpdate}
                disabled={updating}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-all hover:shadow-lg active:scale-95 disabled:opacity-50"
              >
                <ArrowUpCircle size={14} />
                Procedi con l'Aggiornamento
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
