import React, { useState, useEffect, useRef } from 'react';
import { 
  Paperclip, 
  Loader2, 
  Trash2, 
  Link,
  ExternalLink,
  Plus,
  Settings,
  HardDrive,
  X,
  Download,
  FileText,
  Eye
} from 'lucide-react';
import { getAttachments, deleteAttachment, addAttachmentLink } from '../lib/db';

interface Attachment {
  id: string;
  nome_originale: string;
  nome_file: string;
  percorso_file: string;
  dimensione: number;
  data_caricamento: string;
}

interface AttachmentManagerProps {
  type: 'client' | 'quotation';
  id: string;
  title?: string;
  className?: string;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ 
  type, 
  id, 
  title = "Allegati",
  className = "" 
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [nasRoot, setNasRoot] = useState(localStorage.getItem('nas_root_path') || '\\\\NAS\\Upload\\');
  const [error, setError] = useState<string | null>(null);
  const [isElectronActive, setIsElectronActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkBridge = async () => {
      try {
        const res = await fetch('http://localhost:4500/select-file'); 
        setIsElectronActive(true);
      } catch (e) {
        setIsElectronActive(false);
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 10000);
    return () => clearInterval(interval);
  }, []);

  const openWithElectron = async (path: string) => {
    try {
      await fetch('http://localhost:4500/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });
    } catch (err) {
      alert("Errore: Assicurati che l'app Bridge sia aperta sul tuo computer.");
    }
  };

  useEffect(() => {
    if (id && id !== 'new') {
      loadAttachments();
    }
  }, [type, id]);

  const loadAttachments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAttachments(type, id);
      setAttachments(data.attachments || data || []);
    } catch (err: any) {
      setError("Errore caricamento allegati");
    } finally {
      setLoading(false);
    }
  };

  const handlePhysicalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (id === 'new') {
      alert("Salva prima il preventivo.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch(`/api/upload/${type}/${id}`, {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Errore upload");
        }
      }
      
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || "Errore durante l'upload");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleElectronBrowse = async () => {
    if (!isElectronActive) return;
    
    setLoading(true);
    try {
      const selectRes = await fetch('http://localhost:4500/select-file');
      const fileData = await selectRes.json();
      
      if (fileData.canceled) {
        setLoading(false);
        return;
      }

      await fetch('/api/attachments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fileData.path,
          type,
          id
        })
      });

      await loadAttachments();
    } catch (err) {
      setError("Errore comunicazione con Bridge Electron");
    } finally {
      setLoading(false);
    }
  };

  const handleManualLink = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (id === 'new') {
      alert("Salva prima il preventivo.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let root = nasRoot.trim();
      if (root && !root.endsWith('\\') && !root.endsWith('/')) {
        root += root.includes('/') ? '/' : '\\';
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fullPath = `${root}${file.name}`;
        // SALVIAMO SOLO IL PERCORSO (LINK), NON CARICHIAMO IL FILE
        await addAttachmentLink(fullPath, type, id);
      }
      
      await loadAttachments();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || "Errore durante il collegamento");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Rimuovere questo collegamento?")) return;
    try {
      await deleteAttachment(attachmentId);
      await loadAttachments();
    } catch (err: any) {
      setError("Errore durante l'eliminazione");
    }
  };

  if (!id || id === 'new') {
    return (
      <div className={`p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center ${className}`}>
        <Paperclip className="mx-auto text-gray-400 mb-2" size={24} />
        <p className="text-xs text-gray-500 font-medium">Salva prima il preventivo per poter inserire i link ai file.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h4 className="text-[12px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
          <Paperclip size={16} />
          {title} ({attachments.length})
          <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full lowercase tracking-normal font-medium ${isElectronActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isElectronActive ? 'bg-green-500' : 'bg-gray-400'}`} />
            bridge: {isElectronActive ? 'attivo' : 'offline'}
          </span>
        </h4>
        <div className="flex items-center gap-2">
           {loading && <Loader2 size={14} className="animate-spin text-blue-600" />}
           
           <input 
             type="file" 
             ref={fileInputRef}
             onChange={handleManualLink}
             className="hidden" 
             multiple
           />

           <input 
             type="file" 
             id="physical-upload"
             onChange={handlePhysicalUpload}
             className="hidden" 
           />

           <div className="flex bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
             <button 
               onClick={() => document.getElementById('physical-upload')?.click()}
               disabled={loading}
               className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 text-blue-600 text-[10px] font-bold border-r border-gray-100 transition-all disabled:opacity-50"
               title="Carica il file fisicamente sul server"
             >
               <Plus size={14} />
               CARICA SUL SERVER
             </button>
             
             <button 
               onClick={() => fileInputRef.current?.click()}
               disabled={loading}
               className="flex items-center gap-1.5 px-3 py-2 hover:bg-gray-50 text-orange-600 text-[10px] font-bold border-r border-gray-100 transition-all disabled:opacity-50"
               title="Collega un file usando il percorso radice impostato sotto"
             >
               <Link size={14} />
               LINK MANUALE
             </button>

             {isElectronActive && (
               <button 
                 onClick={handleElectronBrowse}
                 disabled={loading}
                 className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold transition-all disabled:opacity-50"
                 title="Sfoglia file sul NAS usando Electron"
               >
                 <HardDrive size={14} />
                 SFOGLIA NAS
               </button>
             )}
           </div>
        </div>
      </div>

      <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold text-orange-800 uppercase flex items-center gap-1">
            <Settings size={12} />
            Percorso Radice (NAS o Cartella Locale)
          </label>
        </div>
        <input 
          type="text"
          value={nasRoot}
          onChange={(e) => {
            setNasRoot(e.target.value);
            localStorage.setItem('nas_root_path', e.target.value);
          }}
          className="w-full px-3 py-2 text-[12px] font-mono border border-orange-200 rounded-md outline-none focus:border-orange-500 bg-white shadow-sm"
          placeholder="Esempio: \\NAS\Preventivi\  oppure  C:\Lavori\"
        />
        <p className="text-[9px] text-orange-600 mt-2 italic leading-tight">
          * Quando scegli un file, il sistema aggiungerà il suo nome a questo percorso e lo salverà come link nel database.
        </p>
      </div>

      <div className="space-y-3">
        {attachments.length > 0 ? (
          attachments.map((att) => (
            <div key={att.id} className="flex flex-col p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 transition-all group shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Link size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-gray-900 truncate max-w-[300px]">
                      {att.nome_originale.split('\\').pop()?.split('/').pop()}
                    </span>
                    <span className="text-[9px] text-orange-600 uppercase font-bold tracking-tighter">
                      Link salvato nel Database
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (att.nome_file === 'manual_link' && isElectronActive) {
                        openWithElectron(att.nome_originale);
                      } else {
                        window.open(`/api/attachment-preview/${att.id}`, '_blank');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      att.nome_file === 'manual_link' && isElectronActive
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Eye size={14} />
                    {att.nome_file === 'manual_link' && isElectronActive ? 'APRI LOCALE' : 'ANTEPRIMA'}
                  </button>
                  
                  <button 
                    onClick={() => window.open(`/api/attachments/download/${att.id}`, '_blank')}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                    title="Scarica file"
                  >
                    <Download size={14} />
                  </button>

                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(att.nome_originale);
                      alert("PERCORSO COPIATO!\n\nIncollalo in una cartella per aprire il file.");
                    }}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                    title="Copia Percorso"
                  >
                    <ExternalLink size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(att.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 p-2.5 rounded-md border border-gray-100">
                <p className="text-[11px] font-mono text-gray-600 break-all leading-tight select-all">
                  {att.nome_originale}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <Paperclip size={32} className="mx-auto text-gray-300 mb-3 opacity-40" />
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nessun collegamento</p>
            <p className="text-[10px] text-gray-400 mt-2">Usa il pulsante in alto per collegare i tuoi file.</p>
          </div>
        )}
      </div>
    </div>
  );
};
