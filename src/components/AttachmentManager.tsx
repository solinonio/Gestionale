import React, { useState, useEffect, useRef } from 'react';
import { 
  Paperclip, 
  Trash2, 
  Download, 
  FileUp, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Eye, 
  X,
  Link,
  ExternalLink,
  Plus
} from 'lucide-react';
import { getAttachments, uploadAttachment, downloadAttachment, deleteAttachment, addAttachmentLink } from '../lib/db';

interface Attachment {
  id: string;
  nome_originale: string;
  nome_file: string;
  dimensione: number;
  data_caricamento: string;
  mimetype?: string;
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
  title = "Gestione Allegati Server",
  className = "" 
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPathInput, setShowPathInput] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAttachments(data || []);
    } catch (err: any) {
      console.error("Errore caricamento allegati:", err);
      setError("Impossibile caricare gli allegati");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualPath = async () => {
    if (!manualPath.trim()) return;
    
    if (id === 'new') {
      alert("Salva l'elemento prima di poter aggiungere allegati.");
      return;
    }

    setLoading(true);
    try {
      await addAttachmentLink(manualPath.trim(), type, id);
      setManualPath('');
      setShowPathInput(false);
      await loadAttachments();
    } catch (err: any) {
      setError(err.message || "Errore durante l'aggiunta del percorso");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (id === 'new') {
      alert("Salva l'elemento prima di poter caricare degli allegati.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadAttachment(files[i], type, id);
      }
      await loadAttachments();
    } catch (err: any) {
      console.error("Errore upload allegato:", err);
      setError(err.message || "Errore durante l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo allegato?")) return;

    try {
      await deleteAttachment(attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err: any) {
      console.error("Errore eliminazione allegato:", err);
      alert("Errore durante l'eliminazione");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (att: Attachment) => {
    if (att.nome_file === 'manual_link') return <Link size={18} className="text-orange-500" />;
    const filename = att.nome_originale;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon size={18} className="text-blue-500" />;
    if (ext === 'pdf') return <FileText size={18} className="text-red-500" />;
    return <File size={18} className="text-gray-500" />;
  };

  if (!id || id === 'new') {
    return (
      <div className={`p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center ${className}`}>
        <Paperclip className="mx-auto text-gray-400 mb-2" size={24} />
        <p className="text-xs text-gray-500 font-medium">Salva prima l'elemento per poter gestire gli allegati sul server.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip size={14} className="text-blue-600" />
          {title} ({attachments.length})
        </h4>
        <div className="flex items-center gap-2">
           {uploading && <Loader2 size={14} className="animate-spin text-blue-600" />}
           <button 
             onClick={() => setShowPathInput(!showPathInput)}
             className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold transition-colors"
           >
             <Link size={12} />
             INSERISCI PERCORSO
           </button>
           <button 
             onClick={() => fileInputRef.current?.click()}
             disabled={uploading}
             className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors disabled:opacity-50"
           >
             <Plus size={12} />
             CARICA FILE
           </button>
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileUpload} 
             multiple 
             className="hidden" 
           />
        </div>
      </div>

      {showPathInput && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md space-y-2">
          <p className="text-[10px] font-bold text-blue-800">Inserisci il percorso completo del file (NAS o Locale):</p>
          <div className="flex gap-2">
            <input 
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="Esempio: \\NAS\Documenti\File.pdf oppure C:\Lavori\Disegno.jpg"
              className="flex-1 px-2 py-1.5 text-[11px] border border-blue-200 rounded outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddManualPath()}
            />
            <button 
              onClick={handleAddManualPath}
              className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700"
            >
              AGGIUNGI
            </button>
          </div>
          <p className="text-[9px] text-blue-600 italic">Incolla qui il percorso esatto del file per salvarlo nel database.</p>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-100 text-red-600 text-[10px] rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {loading && attachments.length === 0 ? (
        <div className="flex justify-center py-4">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-md hover:border-blue-300 transition-all group">
              <div className="p-1.5 bg-gray-50 rounded border border-gray-100">
                {getFileIcon(att)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-900 truncate" title={att.nome_originale}>
                  {att.nome_originale}
                </p>
                <div className="flex items-center gap-2 text-[9px] text-gray-500 font-medium">
                  {att.nome_file === 'manual_link' ? (
                    <span className="text-orange-600">Percorso NAS/Locale</span>
                  ) : (
                    <span>{formatSize(att.dimensione)}</span>
                  )}
                  <span>•</span>
                  <span>{new Date(att.data_caricamento).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {att.nome_file === 'manual_link' ? (
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(att.nome_originale);
                      alert("Percorso copiato negli appunti!");
                    }}
                    className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                    title="Copia Percorso"
                  >
                    <ExternalLink size={14} />
                  </button>
                ) : (
                  <button 
                    onClick={() => downloadAttachment(att.id)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Scarica"
                  >
                    <Download size={14} />
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(att.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Elimina"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/30">
          <FileUp size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-[10px] text-gray-400">Nessun file caricato sul server.</p>
        </div>
      )}
    </div>
  );
};
