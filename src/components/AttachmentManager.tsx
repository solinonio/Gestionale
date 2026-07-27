import React, { useRef, useState } from 'react';
import { Attachment } from '../types';
import { Paperclip, Download, Trash2, File, FileText, Image as ImageIcon, Plus, Eye, X } from 'lucide-react';

interface AttachmentManagerProps {
  attachments?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export default function AttachmentManager({ attachments = [], onChange, readOnly = false }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingAttachment, setPreviewingAttachment] = useState<Attachment | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onChange) return;

    const fileList = Array.from(files);
    
    Promise.all(
      fileList.map((file: File, index: number) => {
        return new Promise<Attachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (uploadEvent) => {
            const dataUrl = uploadEvent.target?.result as string;
            if (dataUrl) {
              resolve({
                id: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
                filename: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                dataUrl,
                uploadedAt: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
              });
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      })
    ).then((addedAttachments) => {
      if (onChange) {
        onChange([...attachments, ...addedAttachments]);
      }
    }).catch((err) => {
      console.error('Errore durante la lettura degli allegati:', err);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string) => {
    if (!onChange) return;
    const filtered = attachments.filter(att => att.id !== id);
    onChange(filtered);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon size={18} className="text-blue-500" />;
    }
    if (mimeType.includes('pdf') || mimeType.includes('document')) {
      return <FileText size={18} className="text-amber-500" />;
    }
    return <File size={18} className="text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={18} className="text-gray-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Allegati ({attachments.length})</h4>
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
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            >
              <Plus size={16} /> Aggiungi allegato
            </button>
          </div>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-500 text-sm">
          Nessun allegato presente.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white rounded-md border border-gray-100 shadow-xs shrink-0">
                  {getFileIcon(att.mimeType)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={att.filename}>
                    {att.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(att.size)} • {att.uploadedAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setPreviewingAttachment(att)}
                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-all cursor-pointer"
                  title="Visualizza anteprima diretta"
                >
                  <Eye size={16} />
                </button>
                <a
                  href={att.dataUrl}
                  download={att.filename}
                  className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                  title="Scarica allegato"
                >
                  <Download size={16} />
                </a>
                {!readOnly && onChange && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id)}
                    className="p-1.5 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                    title="Elimina allegato"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Anteprima Allegato */}
      {previewingAttachment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip size={18} className="text-amber-400 shrink-0" />
                <h3 className="text-base font-bold truncate text-white" title={previewingAttachment.filename}>
                  Anteprima: {previewingAttachment.filename}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={previewingAttachment.dataUrl}
                  download={previewingAttachment.filename}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all"
                >
                  <Download size={14} /> Scarica
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewingAttachment(null)}
                  className="p-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-all cursor-pointer"
                  title="Chiudi"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-100 flex-1 overflow-auto flex items-center justify-center min-h-[500px]">
              {previewingAttachment.mimeType?.includes('pdf') ||
              previewingAttachment.dataUrl?.startsWith('data:application/pdf') ||
              previewingAttachment.filename.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewingAttachment.dataUrl}
                  title={previewingAttachment.filename}
                  className="w-full h-[75vh] rounded-lg border border-gray-300 bg-white shadow-sm"
                />
              ) : previewingAttachment.mimeType?.startsWith('image/') ||
                previewingAttachment.dataUrl?.startsWith('data:image/') ||
                /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(previewingAttachment.filename) ? (
                <img
                  src={previewingAttachment.dataUrl}
                  alt={previewingAttachment.filename}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md border border-gray-200"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-200 space-y-4">
                  <FileText size={48} className="mx-auto text-gray-400" />
                  <p className="text-gray-700 font-medium">
                    Anteprima non disponibile per questo tipo di file.
                  </p>
                  <a
                    href={previewingAttachment.dataUrl}
                    download={previewingAttachment.filename}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
                  >
                    <Download size={16} /> Scarica il file ({previewingAttachment.filename})
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
