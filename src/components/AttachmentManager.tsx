import React, { useRef, useState, useEffect } from 'react';
import { Attachment } from '../types';
import { Paperclip, Trash2, File, FileText, Image as ImageIcon, Plus, Eye, X, Copy, Check, FolderCheck, HardDrive, Edit2, Save, Settings } from 'lucide-react';
import { connectNasFolder, getFileFromNas } from '../lib/nasBridge';

interface AttachmentManagerProps {
  attachments?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export default function AttachmentManager({ attachments = [], onChange, readOnly = false }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Configurazione Radice NAS specifica per questo PC (salvata in LocalStorage locale del PC)
  const [pcNasRoot, setPcNasRoot] = useState<string>(() => {
    return localStorage.getItem('nas_local_root') || '\\\\192.168.0.123\\Preventivi';
  });
  const [showPcNasConfig, setShowPcNasConfig] = useState<boolean>(false);

  // Stato per la modifica del percorso relativo di un allegato
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [tempRelPath, setTempRelPath] = useState<string>('');

  const [nasLiveUrl, setNasLiveUrl] = useState<string | null>(null);
  const [isLoadingNasFile, setIsLoadingNasFile] = useState<boolean>(false);

  // Salva la radice NAS locale in LocalStorage
  const handleSavePcNasRoot = (newRoot: string) => {
    setPcNasRoot(newRoot);
    localStorage.setItem('nas_local_root', newRoot);
  };

  // Costruisce il percorso di rete Windows completo per il PC corrente
  const buildFullPcPath = (relPath?: string): string => {
    if (!relPath) return pcNasRoot || '';
    const clean = relPath.trim();
    // Se è già un percorso assoluto Windows (es. \\IP\share o X:\folder)
    if (clean.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(clean)) {
      return clean.replace(/\//g, '\\');
    }

    let root = (pcNasRoot || '').trim().replace(/\//g, '\\');
    let cleanWin = clean.replace(/\//g, '\\');

    if (!root) return cleanWin;

    if (!root.endsWith('\\') && !cleanWin.startsWith('\\')) {
      root += '\\';
    } else if (root.endsWith('\\') && cleanWin.startsWith('\\')) {
      cleanWin = cleanWin.substring(1);
    }

    return root + cleanWin;
  };

  // Caricamento in tempo reale del file se presente l'handle di sistema
  useEffect(() => {
    if (!previewingAttachment) {
      setNasLiveUrl(null);
      return;
    }

    // Se c'è già un Blob URL attivo di sessione (es. sul PC dove è stato caricato)
    if (previewingAttachment.dataUrl && previewingAttachment.dataUrl.startsWith('blob:')) {
      setNasLiveUrl(previewingAttachment.dataUrl);
      return;
    }

    // Altrimenti proviamo a recuperare il file se la cartella locale/NAS è stata connessa
    let isMounted = true;
    setIsLoadingNasFile(true);
    setNasLiveUrl(null);

    const relPath = previewingAttachment.path || previewingAttachment.filename;
    getFileFromNas(relPath).then(file => {
      if (isMounted && file) {
        const objectUrl = URL.createObjectURL(file);
        setNasLiveUrl(objectUrl);
      }
    }).catch(err => {
      console.warn("Impossibile accedere direttamente al file dal NAS:", err);
    }).finally(() => {
      if (isMounted) setIsLoadingNasFile(false);
    });

    return () => {
      isMounted = false;
    };
  }, [previewingAttachment]);

  // Connessione guidata alla cartella locale/NAS ed eventuale impostazione radice
  const handleConnectFolder = async () => {
    const handle = await connectNasFolder();
    if (handle) {
      if (handle.name) {
        const autoSuggested = `\\\\192.168.0.123\\${handle.name}`;
        if (!localStorage.getItem('nas_local_root')) {
          handleSavePcNasRoot(autoSuggested);
        }
      }
      if (previewingAttachment) {
        const relPath = previewingAttachment.path || previewingAttachment.filename;
        const file = await getFileFromNas(relPath);
        if (file) {
          setNasLiveUrl(URL.createObjectURL(file));
        }
      }
    }
  };

  // Garantisce che nessun dato Base64 venga mai trasmesso al database
  const sanitizeAttachment = (att: Attachment): Attachment => {
    const clean: Attachment = {
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType || 'application/pdf',
      size: att.size || 0,
      uploadedAt: att.uploadedAt || new Date().toLocaleDateString('it-IT'),
      path: att.path || att.filename
    };
    if (att.dataUrl && att.dataUrl.startsWith('blob:')) {
      clean.dataUrl = att.dataUrl;
    }
    return clean;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onChange) return;

    const fileList = Array.from(files);

    const newAttachments: Attachment[] = fileList.map((file: File, index: number) => {
      const sessionBlobUrl = URL.createObjectURL(file);
      
      return sanitizeAttachment({
        id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        path: file.name,
        dataUrl: sessionBlobUrl,
        uploadedAt: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      });
    });

    onChange([...attachments.map(sanitizeAttachment), ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string) => {
    if (!onChange) return;
    const filtered = attachments.filter(att => att.id !== id);
    onChange(filtered);
  };

  // Salva il percorso relativo personalizzato per un allegato
  const handleSaveRelativePath = (id: string) => {
    if (!onChange) return;
    const updated = attachments.map(att => {
      if (att.id === id) {
        return {
          ...att,
          path: tempRelPath.trim() || att.filename
        };
      }
      return att;
    });
    onChange(updated);
    setEditingPathId(null);
  };

  const handleCopyFullPath = (relPath: string, id: string) => {
    const fullPath = buildFullPcPath(relPath);
    navigator.clipboard.writeText(fullPath).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Errore durante la copia negli appunti:", err);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'File su NAS';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string, mimeType?: string) => {
    const fn = filename.toLowerCase();
    if (fn.endsWith('.jpg') || fn.endsWith('.png') || fn.endsWith('.jpeg') || (mimeType && mimeType.startsWith('image/'))) {
      return <ImageIcon size={18} className="text-blue-500" />;
    }
    if (fn.endsWith('.pdf') || (mimeType && mimeType.includes('pdf'))) {
      return <FileText size={18} className="text-rose-500" />;
    }
    return <File size={18} className="text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Header Gestione Allegati */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Paperclip size={18} className="text-gray-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Allegati ({attachments.length})</h4>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded border border-emerald-200">
            Percorsi relativi (nessun file nel DB)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPcNasConfig(!showPcNasConfig)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-gray-300"
            title="Imposta il percorso della cartella NAS su questo specifico PC"
          >
            <HardDrive size={14} className="text-blue-600" />
            <span>Radice NAS PC</span>
          </button>

          {!readOnly && onChange && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Plus size={16} /> Aggiungi File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pannello Configurazione Radice NAS del PC */}
      {showPcNasConfig && (
        <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-3 animate-fade-in shadow-2xs">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5 text-sm text-blue-950">
              <Settings size={16} className="text-blue-600" />
              Configurazione Radice NAS per questo PC:
            </span>
            <button
              type="button"
              onClick={() => setShowPcNasConfig(false)}
              className="text-blue-600 hover:text-blue-800 font-bold p-1 rounded cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-gray-600 leading-relaxed text-[11px]">
            I browser per sicurezza non consentono alle pagine web di leggere in automatico la lettera del disco (es. <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono">Z:\</code>).
            Per non dover scrivere a mano, puoi **selezionare la cartella dal tuo PC** oppure scegliere una **scorciatoia rapida**:
          </p>

          {/* Opzione 1: Selezione con 1 Click via Windows Explorer */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
            <div className="text-xs">
              <span className="font-bold text-gray-800 block">1. Selezione Visiva Cartella Windows</span>
              <span className="text-[11px] text-gray-500">Apre la finestra di dialogo Windows per scegliere la cartella sul NAS.</span>
            </div>
            <button
              type="button"
              onClick={handleConnectFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <FolderCheck size={16} />
              <span>Sfoglia Cartella Windows</span>
            </button>
          </div>

          {/* Opzione 2: Scorciatoie Preimpostate */}
          <div className="space-y-1.5">
            <span className="font-bold text-gray-700 text-[11px] block">2. Scorciatoie Rapide (Clicca per applicare subito):</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                '\\\\192.168.0.123\\Preventivi',
                'Z:\\Preventivi',
                'X:\\NAS\\Preventivi',
                '\\\\NAS\\Preventivi',
                'D:\\Allegati'
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSavePcNasRoot(preset)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                    pcNasRoot === preset
                      ? 'bg-blue-600 text-white border-blue-700 font-bold shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Opzione 3: Campo Personalizzato */}
          <div className="space-y-1 pt-2 border-t border-blue-200">
            <span className="font-bold text-gray-700 text-[11px] block">3. Personalizza il percorso per questo PC (o modifica l'esistente):</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={pcNasRoot}
                onChange={(e) => handleSavePcNasRoot(e.target.value)}
                placeholder="es. \\192.168.0.123\Preventivi o Z:\NAS"
                className="flex-1 px-2.5 py-1.5 bg-white border border-blue-300 rounded text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-gray-900"
              />
              <button
                type="button"
                onClick={() => setShowPcNasConfig(false)}
                className="px-3.5 py-1.5 bg-blue-600 text-white font-bold rounded text-xs cursor-pointer hover:bg-blue-700 transition-colors"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista Allegati */}
      {attachments.length === 0 ? (
        <div 
          onClick={() => !readOnly && onChange && fileInputRef.current?.click()}
          className={`p-6 border-2 border-dashed border-gray-200 rounded-xl text-center text-gray-500 text-sm ${!readOnly && onChange ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all' : ''}`}
        >
          <Paperclip size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="font-medium text-gray-700">Nessun file allegato</p>
          {!readOnly && onChange && (
            <p className="text-xs text-gray-400 mt-1">Clicca per selezionare un file da qualsiasi posizione</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att) => {
            const relPath = att.path || att.filename;
            const fullPcPath = buildFullPcPath(relPath);
            const isEditing = editingPathId === att.id;

            return (
              <div key={att.id} className="flex flex-col justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 transition-all gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="p-2 bg-white rounded-md border border-gray-200 shadow-2xs shrink-0 mt-0.5">
                    {getFileIcon(att.filename, att.mimeType)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate" title={att.filename}>
                      {att.filename}
                    </p>

                    {/* Percorso relativo nel DB */}
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={tempRelPath}
                          onChange={(e) => setTempRelPath(e.target.value)}
                          placeholder="Percorso relativo (es. Disegni/2026/file.pdf)"
                          className="flex-1 px-1.5 py-0.5 text-[11px] font-mono bg-white border border-blue-400 rounded focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRelativePath(att.id)}
                          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                          title="Salva percorso relativo"
                        >
                          <Save size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPathId(null)}
                          className="p-1 text-gray-500 hover:text-gray-700 cursor-pointer"
                          title="Annulla"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-1 group">
                        <p className="text-[11px] text-gray-700 font-mono truncate bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex-1" title={`Percorso relativo nel DB: ${relPath}`}>
                          📁 {relPath}
                        </p>
                        {!readOnly && onChange && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPathId(att.id);
                              setTempRelPath(relPath);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                            title="Modifica percorso relativo nel DB"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatFileSize(att.size)} • {att.uploadedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyFullPath(relPath, att.id)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-blue-600 transition-colors cursor-pointer"
                    title={`Copia percorso completo per questo PC: ${fullPcPath}`}
                  >
                    {copiedId === att.id ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Percorso Copiato!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copia Percorso PC</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewingAttachment(att)}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded transition-all cursor-pointer border border-indigo-200"
                      title="Visualizza Anteprima / Dettagli"
                    >
                      <Eye size={14} /> Anteprima
                    </button>

                    {!readOnly && onChange && (
                      <button
                        type="button"
                        onClick={() => handleDelete(att.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                        title="Rimuovi collegamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Anteprima File */}
      {previewingAttachment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-2xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={18} className="text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold truncate text-white" title={previewingAttachment.filename}>
                  Dettagli Allegato: {previewingAttachment.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingAttachment(null)}
                className="text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 bg-gray-50 flex-1 overflow-auto space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 max-w-full">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">File Collegato</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{previewingAttachment.filename}</p>
                </div>
                <div className="min-w-0 max-w-full">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Percorso Relativo (nel DB)</p>
                  <p className="text-xs font-mono bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-800 break-all">
                    {previewingAttachment.path || previewingAttachment.filename}
                  </p>
                </div>
              </div>

              {/* Contenuto / Anteprima */}
              {nasLiveUrl ? (
                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-2xs">
                  {previewingAttachment.filename.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={nasLiveUrl}
                      title={previewingAttachment.filename}
                      className="w-full h-[60vh] rounded-lg border border-gray-200 bg-white"
                    />
                  ) : (
                    <img
                      src={nasLiveUrl}
                      alt={previewingAttachment.filename}
                      className="max-h-[60vh] max-w-full object-contain mx-auto rounded-lg"
                    />
                  )}
                </div>
              ) : isLoadingNasFile ? (
                <div className="p-12 bg-white rounded-xl border border-gray-200 text-center space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                  <p className="text-sm font-medium text-gray-700">Ricerca e caricamento file in corso...</p>
                </div>
              ) : (
                <div className="p-8 bg-white rounded-xl border border-gray-200 text-center space-y-4">
                  <FileText size={48} className="mx-auto text-blue-500" />
                  <div className="space-y-1">
                    <p className="text-base font-bold text-gray-800">
                      {previewingAttachment.filename}
                    </p>
                    <p className="text-xs text-gray-500 max-w-xl mx-auto leading-relaxed">
                      Questo allegato è salvato nel database come <strong>percorso relativo</strong>. Clicca su <strong>"Copia Percorso Completo PC"</strong> per incollarlo in Esplora File di Windows (oppure premi Win + R), oppure usa <strong>"Collega Cartella"</strong> per abilitare l'anteprima diretta.
                    </p>
                  </div>

                  {/* Visualizzazione percorso calcolato per il PC corrente */}
                  <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 max-w-xl mx-auto text-left space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 block">Percorso Completo Generato per questo PC:</span>
                      <button
                        type="button"
                        onClick={() => setShowPcNasConfig(true)}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Settings size={10} /> Modifica Radice NAS PC
                      </button>
                    </div>
                    <code className="block bg-white p-2.5 rounded border border-gray-300 font-mono text-gray-800 break-all select-all font-semibold">
                      {buildFullPcPath(previewingAttachment.path || previewingAttachment.filename)}
                    </code>
                  </div>

                  <div className="flex flex-wrap justify-center items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleCopyFullPath(previewingAttachment.path || previewingAttachment.filename, previewingAttachment.id)}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {copiedId === previewingAttachment.id ? (
                        <>
                          <Check size={16} className="text-emerald-300" />
                          <span>Percorso Copiato!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copia Percorso Completo PC</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectFolder}
                      className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Seleziona la cartella contenente i file per abilitare l'anteprima diretta nel browser"
                    >
                      <FolderCheck size={16} />
                      <span>Collega Cartella per Anteprima Diretta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



