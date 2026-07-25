import React, { useRef } from 'react';
import { Attachment } from '../types';
import { Paperclip, Download, Trash2, File, FileText, Image as ImageIcon, Plus } from 'lucide-react';

interface AttachmentManagerProps {
  attachments?: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export default function AttachmentManager({ attachments = [], onChange, readOnly = false }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
