import React, { useRef, useState } from 'react';
import { Attachment } from '../types';
import { Paperclip, Trash2, File, FileText, Image as ImageIcon, Plus, Eye, X, Copy, Check } from 'lucide-react';

interface AttachmentManagerProps {
  attachments?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export default function AttachmentManager({ attachments = [], onChange, readOnly = false }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Garantisce che nessun dato Base64 venga mai trasmesso al database
  const sanitizeAttachment = (att: Attachment): Attachment => {
    const clean: Attachment = {
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType || 'application/pdf',
      size: att.size || 0,
      uploadedAt: att.uploadedAt || new Date().toLocaleDateString('it-IT'),
      path: att.path || `allegati/${att.filename}`
    };
    // Se c'è un Blob URL temporaneo di sessione (blob:http...), lo mantiene in memoria locale per l'anteprima istantanea
    if (att.dataUrl && att.dataUrl.startsWith('blob:')) {
      clean.dataUrl = att.dataUrl;
    }
    return clean;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onChange) return;

    const fileList = Array.from(files);

    // Generazione automatica dei collegamenti senza salvare il binario
    const newAttachments: Attachment[] = fileList.map((file: File, index: number) => {
      // Blob URL temporaneo valido solo durante la sessione browser per l'anteprima immediata
      const sessionBlobUrl = URL.createObjectURL(file);
      
      return sanitizeAttachment({
        id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        path: `allegati/${file.name}`,
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

  const handleCopyPath = (pathString: string, id: string) => {
    navigator.clipboard.writeText(pathString).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error("Errore durante la copia negli appunti:", err);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return 'File sul NAS';
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Paperclip size={18} className="text-gray-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Allegati Collegati ({attachments.length})</h4>
          <span className="text-[10px] bg-emerald-50 text-emerald-800 font-medium px-2 py-0.5 rounded border border-emerald-200">
            Solo collegamenti testuali (nessun file nel database)
          </span>
        </div>
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
            const displayPath = att.path || `allegati/${att.filename}`;
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
                    <p className="text-[11px] text-gray-600 font-mono truncate bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 mt-1" title={displayPath}>
                      📁 {displayPath}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatFileSize(att.size)} • {att.uploadedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleCopyPath(displayPath, att.id)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
                    title="Copia percorso NAS"
                  >
                    {copiedId === att.id ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copiato!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copia Percorso</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewingAttachment(att)}
                      className="flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded transition-all cursor-pointer border border-indigo-200"
                      title="Visualizza Anteprima"
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
            <div className="bg-gray-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={18} className="text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold truncate text-white" title={previewingAttachment.filename}>
                  Anteprima: {previewingAttachment.filename}
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

            <div className="p-6 bg-gray-50 flex-1 overflow-auto space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">File Collegato</p>
                  <p className="text-sm font-bold text-gray-900">{previewingAttachment.filename}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Percorso NAS</p>
                  <p className="text-xs font-mono bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-800">
                    {previewingAttachment.path || `allegati/${previewingAttachment.filename}`}
                  </p>
                </div>
              </div>

              {previewingAttachment.dataUrl && previewingAttachment.dataUrl.startsWith('blob:') ? (
                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-2xs">
                  {previewingAttachment.filename.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={previewingAttachment.dataUrl}
                      title={previewingAttachment.filename}
                      className="w-full h-[60vh] rounded-lg border border-gray-200 bg-white"
                    />
                  ) : (
                    <img
                      src={previewingAttachment.dataUrl}
                      alt={previewingAttachment.filename}
                      className="max-h-[60vh] max-w-full object-contain mx-auto rounded-lg"
                    />
                  )}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-xl border border-gray-200 text-center space-y-3">
                  <FileText size={48} className="mx-auto text-blue-500" />
                  <p className="text-base font-bold text-gray-800">
                    {previewingAttachment.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    Il file risiede nel NAS locale al percorso: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono">{previewingAttachment.path || `allegati/${previewingAttachment.filename}`}</code>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyPath(previewingAttachment.path || `allegati/${previewingAttachment.filename}`, previewingAttachment.id)}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs mt-2"
                  >
                    <Copy size={15} /> Copia Percorso NAS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
