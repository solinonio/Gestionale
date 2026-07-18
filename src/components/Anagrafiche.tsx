import React, { useState, useEffect } from 'react';
import CompanyProfileForm from './CompanyProfileForm';
import ClientManager from './ClientManager';
import PresentationTextForm from './PresentationTextForm';
import ConditionsTextForm from './ConditionsTextForm';
import { 
  Building2, 
  FileText, 
  FileCheck2, 
  Users,
  Paperclip,
  Trash2,
  Eye,
  Loader2,
  Check,
  Pencil,
  X,
  FileUp
} from 'lucide-react';
import { Client, ClientAttachment } from '../types';
import { updateClient, saveQuotation, getCompanyProfile } from '../lib/db';

interface Props {
  setActiveTab: (tab: 'home' | 'quotations' | 'anagrafiche' | 'laser' | 'ai') => void;
  selectedClientId?: string | null;
  onClearSelectedClient?: () => void;
  key?: string;
}

// PDF Viewer Modal component
interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfPath: string;
}

function PDFViewerModal({ isOpen, onClose, pdfPath }: PDFViewerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-950 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Visualizzatore PDF Allegato</h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(pdfPath, '_blank')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
            >
              Apri in nuova scheda
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 font-bold text-xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
        
        {/* Iframe content */}
        <div className="flex-1 bg-gray-100 relative">
          <iframe
            src={pdfPath}
            className="w-full h-full border-none"
            title="PDF Viewer"
          />
        </div>
      </div>
    </div>
  );
}

export default function Anagrafiche({ setActiveTab, selectedClientId, onClearSelectedClient }: Props) {
  const [activeTopTab, setActiveTopTab] = useState<'azienda' | 'presentazione' | 'condizioni' | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'clienti' | 'allegati'>('clienti');

  // Shared state between Clienti tab
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Attachment details state
  const [localAttachmentPath, setLocalAttachmentPath] = useState<string | null>(null);
  const [localAttachmentName, setLocalAttachmentName] = useState<string | null>(null);
  const [attachmentDetails, setAttachmentDetails] = useState({ date: new Date().toISOString().split('T')[0], progressive: '', amount: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerPdfPath, setViewerPdfPath] = useState<string>('');

  // Editing attachment state
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState({ date: '', progressive: '', amount: '' });
  const [editingAttachmentPath, setEditingAttachmentPath] = useState<string>('');
  const [editingAttachmentFilename, setEditingAttachmentFilename] = useState<string>('');

  const handleSelectClient = (client: Client | null) => {
    setSelectedClient(client);
    setLocalAttachmentPath(null);
    setLocalAttachmentName(null);
    setEditingAttachmentId(null);
    setAttachmentDetails({
      date: new Date().toISOString().split('T')[0],
      progressive: '',
      amount: ''
    });
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Formato non valido. Sono ammessi solo file PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setLocalAttachmentPath(result.path);
        setLocalAttachmentName(file.name);
      } else {
        alert("Errore caricamento: " + result.error);
      }
    } catch (err) {
      console.error("Errore upload:", err);
      alert(`Errore durante l'invio del file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Formato non valido. Sono ammessi solo file PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setEditingAttachmentPath(result.path);
        setEditingAttachmentFilename(file.name);
      } else {
        alert("Errore caricamento: " + result.error);
      }
    } catch (err) {
      console.error("Errore upload:", err);
      alert(`Errore durante l'invio del file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDirectPdfReplace = async (e: React.ChangeEvent<HTMLInputElement>, attachmentId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Formato non valido. Sono ammessi solo file PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        if (!selectedClient) return;

        const isLegacy = attachmentId === 'legacy-attachment';
        const currentAttachments = [...(selectedClient.attachments || [])];

        let updatedAttachments = [...currentAttachments];
        if (!isLegacy) {
          updatedAttachments = currentAttachments.map(att => {
            if (att.id === attachmentId) {
              return {
                ...att,
                path: result.path,
                filename: file.name
              };
            }
            return att;
          });
        }

        let mainPath = isLegacy ? result.path : selectedClient.attachmentPath;
        let mainDate = selectedClient.attachmentDate;
        let mainProg = selectedClient.attachmentProgressive;
        let mainAmount = selectedClient.attachmentAmount;

        if (!isLegacy && updatedAttachments.length > 0) {
          const last = updatedAttachments[updatedAttachments.length - 1];
          mainPath = last.path;
          mainDate = last.date;
          mainProg = last.progressive;
          mainAmount = last.amount;
        }

        const updatedClient: Client = {
          ...selectedClient,
          attachments: isLegacy ? undefined : updatedAttachments,
          attachmentPath: mainPath,
          attachmentDate: mainDate,
          attachmentProgressive: mainProg,
          attachmentAmount: mainAmount
        };

        await updateClient(selectedClient.id, updatedClient);
        setSelectedClient(updatedClient);
        alert('File PDF ricaricato con successo!');
        window.dispatchEvent(new CustomEvent('database-synced'));
      } else {
        alert("Errore caricamento: " + result.error);
      }
    } catch (err) {
      console.error("Errore upload:", err);
      alert(`Errore durante il caricamento: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveAttachment = async () => {
    if (!selectedClient) return;
    if (!localAttachmentPath) {
      alert("Carica prima un file PDF!");
      return;
    }
    if (!attachmentDetails.date || !attachmentDetails.progressive || !attachmentDetails.amount) {
      alert("Compila tutti i campi obbligatori (Data, Progressivo, Importo)!");
      return;
    }

    const amountNum = parseFloat(attachmentDetails.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Inserisci un importo valido!");
      return;
    }

    const newAttachmentId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const newAttachment: ClientAttachment = {
      id: newAttachmentId,
      path: localAttachmentPath,
      filename: localAttachmentName || 'Documento PDF',
      date: attachmentDetails.date,
      progressive: attachmentDetails.progressive,
      amount: amountNum,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Fetch company info to build the quotation
      const companyInfo = await getCompanyProfile() || {
        name: '', address: '', cap: '', city: '', phone: '', email: '', vatNumber: '', sdiCode: '', pec: '',
        presentationText: '', conditionsText: ''
      };

      // 2. Parse year
      const parsedYear = new Date(attachmentDetails.date).getFullYear() || new Date().getFullYear();

      // 3. Create a new Quotation object
      const newQuotation = {
        clientId: selectedClient.id,
        number: attachmentDetails.progressive,
        year: parsedYear,
        status: 'DRAFT' as const,
        date: attachmentDetails.date,
        totalAmount: amountNum,
        companyInfo: companyInfo,
        clientInfo: selectedClient,
        rows: [
          {
            id: Date.now().toString(36) + "-r1",
            description: `PREVENTIVO ALLEGATO - PROG. ${attachmentDetails.progressive} - PDF: ${localAttachmentName || 'documento.pdf'}`,
            quantity: 1,
            price: amountNum,
            discount: null,
            isDescriptionOnly: false,
            isOmaggio: false
          }
        ],
        notes: `Generato automaticamente dal caricamento dell'allegato PDF in Anagrafiche.`,
        internalNotes: `Allegato PDF associato: ${localAttachmentName || 'documento.pdf'}\nPercorso: ${localAttachmentPath}`,
        internalRows: [],
        condizioni: companyInfo.conditionsText || '',
        presentationText: companyInfo.presentationText || '',
        showTotal: true,
        attachment: localAttachmentPath,
        attachmentDate: attachmentDetails.date,
        attachmentProgressive: attachmentDetails.progressive,
        attachmentAmount: amountNum,
        isImported: true
      };

      // 4. Save the Quotation
      await saveQuotation(newQuotation);

      // 5. Update the Client with the new attachment in the list
      const updatedAttachments = [
        ...(selectedClient.attachments || []),
        newAttachment
      ];

      const updatedClient: Client = {
        ...selectedClient,
        attachments: updatedAttachments,
        attachmentPath: localAttachmentPath,
        attachmentDate: attachmentDetails.date,
        attachmentProgressive: attachmentDetails.progressive,
        attachmentAmount: amountNum
      };

      await updateClient(selectedClient.id, updatedClient);
      setSelectedClient(updatedClient);

      // Reset new attachment inputs
      setLocalAttachmentPath(null);
      setLocalAttachmentName(null);
      setAttachmentDetails({
        date: new Date().toISOString().split('T')[0],
        progressive: '',
        amount: ''
      });

      // Clear the file input if we can find it
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      alert('Allegato salvato con successo e nuovo preventivo generato!');
      
      // Sync DB
      window.dispatchEvent(new CustomEvent('database-synced'));
    } catch (err) {
      console.error("Errore salvataggio allegato e creazione preventivo:", err);
      alert(`Errore durante il salvataggio: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedClient) return;

    if (!confirm("Sei sicuro di voler eliminare questo allegato? Questa azione non eliminerà il preventivo associato.")) {
      return;
    }

    const currentAttachments = [...(selectedClient.attachments || [])];
    const isLegacy = attachmentId === 'legacy-attachment';
    
    let updatedAttachments = currentAttachments.filter(a => a.id !== attachmentId);

    const mainPath = isLegacy ? undefined : (updatedAttachments[updatedAttachments.length - 1]?.path || undefined);
    const mainDate = isLegacy ? undefined : (updatedAttachments[updatedAttachments.length - 1]?.date || undefined);
    const mainProg = isLegacy ? undefined : (updatedAttachments[updatedAttachments.length - 1]?.progressive || undefined);
    const mainAmount = isLegacy ? undefined : (updatedAttachments[updatedAttachments.length - 1]?.amount || undefined);

    const updatedClient: Client = {
      ...selectedClient,
      attachments: updatedAttachments,
      attachmentPath: isLegacy ? undefined : mainPath,
      attachmentDate: isLegacy ? undefined : mainDate,
      attachmentProgressive: isLegacy ? undefined : mainProg,
      attachmentAmount: isLegacy ? undefined : mainAmount
    };

    try {
      await updateClient(selectedClient.id, updatedClient);
      setSelectedClient(updatedClient);
      
      if (viewerPdfPath === (isLegacy ? selectedClient.attachmentPath : currentAttachments.find(a => a.id === attachmentId)?.path)) {
        setViewerPdfPath('');
        setIsViewerOpen(false);
      }

      alert('Allegato rimosso con successo!');
      window.dispatchEvent(new CustomEvent('database-synced'));
    } catch (err) {
      console.error("Errore eliminazione allegato:", err);
      alert("Errore durante la rimozione dell'allegato.");
    }
  };

  const handleUpdateAttachment = async (attachmentId: string) => {
    if (!selectedClient) return;

    if (!editingDetails.date || !editingDetails.progressive || !editingDetails.amount) {
      alert("Compila tutti i campi!");
      return;
    }

    const amountNum = parseFloat(editingDetails.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Inserisci un importo valido!");
      return;
    }

    const isLegacy = attachmentId === 'legacy-attachment';
    const currentAttachments = [...(selectedClient.attachments || [])];

    let updatedAttachments = [...currentAttachments];
    if (!isLegacy) {
      updatedAttachments = currentAttachments.map(att => {
        if (att.id === attachmentId) {
          return {
            ...att,
            date: editingDetails.date,
            progressive: editingDetails.progressive,
            amount: amountNum,
            path: editingAttachmentPath || att.path,
            filename: editingAttachmentFilename || att.filename
          };
        }
        return att;
      });
    }

    // Determine the main legacy fields backwards-compatibility values
    let mainPath = isLegacy ? (editingAttachmentPath || selectedClient.attachmentPath) : selectedClient.attachmentPath;
    let mainDate = selectedClient.attachmentDate;
    let mainProg = selectedClient.attachmentProgressive;
    let mainAmount = selectedClient.attachmentAmount;

    if (isLegacy) {
      mainDate = editingDetails.date;
      mainProg = editingDetails.progressive;
      mainAmount = amountNum;
    } else if (updatedAttachments.length > 0) {
      const last = updatedAttachments[updatedAttachments.length - 1];
      mainPath = last.path;
      mainDate = last.date;
      mainProg = last.progressive;
      mainAmount = last.amount;
    }

    const updatedClient: Client = {
      ...selectedClient,
      attachments: isLegacy ? undefined : updatedAttachments,
      attachmentPath: mainPath,
      attachmentDate: mainDate,
      attachmentProgressive: mainProg,
      attachmentAmount: mainAmount
    };

    try {
      await updateClient(selectedClient.id, updatedClient);
      setSelectedClient(updatedClient);
      setEditingAttachmentId(null);
      alert('Allegato modificato con successo!');
      window.dispatchEvent(new CustomEvent('database-synced'));
    } catch (err) {
      console.error("Errore modifica allegato:", err);
      alert("Errore durante la modifica dell'allegato.");
    }
  };

  return (
    <div className="space-y-8 text-gray-900">
      <div className="flex justify-between items-center">
        <button onClick={() => setActiveTab('quotations')} className="text-gray-700 hover:text-gray-900">&larr; Indietro</button>
      </div>

      {/* Top Tabs */}
      <div className="bg-gray-200 p-6 rounded-lg shadow-sm border border-gray-300">
        <div className="flex border-b border-gray-400 mb-4">
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'azienda' ? null : 'azienda');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'azienda' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <Building2 size={18} /> Azienda
          </button>
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'presentazione' ? null : 'presentazione');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'presentazione' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <FileText size={18} /> Presentazione
          </button>
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'condizioni' ? null : 'condizioni');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'condizioni' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <FileCheck2 size={18} /> Condizioni
          </button>
        </div>
        {activeTopTab === 'azienda' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <CompanyProfileForm />
            </div>
        )}
        {activeTopTab === 'presentazione' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <PresentationTextForm />
            </div>
        )}
        {activeTopTab === 'condizioni' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <ConditionsTextForm />
            </div>
        )}
      </div>

      {/* Bottom Section - Client Manager & Allegati */}
      <div className="bg-gray-200 p-6 rounded-lg shadow-sm border border-gray-300">
        <div className="flex border-b border-gray-400 mb-4">
          <button 
            onClick={() => setActiveBottomTab('clienti')} 
            className={`flex items-center gap-2 px-4 py-2 ${activeBottomTab === 'clienti' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <Users size={18} /> Gestione Clienti
          </button>
          <button 
            onClick={() => setActiveBottomTab('allegati')} 
            className={`flex items-center gap-2 px-4 py-2 ${activeBottomTab === 'allegati' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <Paperclip size={18} /> Allegati PDF Cliente
          </button>
        </div>

        {activeBottomTab === 'clienti' && (
          <ClientManager 
            initialSelectedClientId={selectedClientId}
            onClearInitialSelectedClientId={onClearSelectedClient}
            selectedClient={selectedClient}
            onSelectClient={handleSelectClient}
          />
        )}

        {activeBottomTab === 'allegati' && (
          <div className="anagrafiche-allegati-container bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            {!selectedClient ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-base font-semibold">Nessun cliente selezionato</p>
                <p className="text-sm mt-1">Seleziona prima un cliente dalla scheda "Gestione Clienti" per associarvi degli allegati.</p>
              </div>
            ) : (() => {
              // Build dynamic backwards-compatible attachments list
              const clientAttachments: ClientAttachment[] = [...(selectedClient.attachments || [])];
              if (selectedClient.attachmentPath && !clientAttachments.some(a => a.path === selectedClient.attachmentPath)) {
                clientAttachments.unshift({
                  id: 'legacy-attachment',
                  path: selectedClient.attachmentPath,
                  filename: selectedClient.attachmentPath.split('/').pop() || 'Documento PDF',
                  date: selectedClient.attachmentDate || '',
                  progressive: selectedClient.attachmentProgressive || 'Legacy',
                  amount: selectedClient.attachmentAmount || 0,
                  createdAt: new Date().toISOString()
                });
              }

              return (
                <div className="space-y-6 text-gray-900">
                  <div>
                    <h3 className="font-bold text-lg text-blue-900 mb-1">
                      Gestione Allegati PDF
                    </h3>
                    <p className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
                      Cliente selezionato: 
                      <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-md border border-green-200 shadow-xs animate-pulse">
                        <Check size={14} className="stroke-[3]" />
                        {selectedClient.intestazione || selectedClient.name}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Caricamento (Left Panel) */}
                    <div className="xl:col-span-12 bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                      <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider">Dettagli Ultimo Allegato Associato</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Data Preventivo <span className="text-red-500">*</span></label>
                          <input 
                            type="date"
                            value={attachmentDetails.date}
                            onChange={(e) => setAttachmentDetails({ ...attachmentDetails, date: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Progressivo <span className="text-red-500">*</span></label>
                          <input 
                            type="text"
                            placeholder="es. 2026/A"
                            value={attachmentDetails.progressive}
                            onChange={(e) => setAttachmentDetails({ ...attachmentDetails, progressive: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">Importo (€) <span className="text-red-500">*</span></label>
                          <input 
                            type="number"
                            step="0.01"
                            placeholder="es. 1250.00"
                            value={attachmentDetails.amount}
                            onChange={(e) => setAttachmentDetails({ ...attachmentDetails, amount: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 italic">
                          Nota: Il caricamento diretto di file PDF è stato disabilitato. Utilizza i collegamenti per gestire i documenti.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* PDF Viewer Popup Modal */}
      {isViewerOpen && viewerPdfPath && (
        <PDFViewerModal 
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false);
            setViewerPdfPath('');
          }}
          pdfPath={viewerPdfPath}
        />
      )}
    </div>
  );
}
