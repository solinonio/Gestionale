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
  FileUp,
  FolderOpen,
  Settings
} from 'lucide-react';
import { Client, ClientAttachment } from '../types';
import { updateClient, saveQuotation, getCompanyProfile } from '../lib/db';
import { connectNasFolder, getFileFromNas, getNasFolderHandle, verifyNasPermission } from '../lib/nasBridge';

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
  const [isNasConnected, setIsNasConnected] = useState(false);
  const [nasRootPath, setNasRootPath] = useState(localStorage.getItem('nas_root_path') || '\\\\NAS\\Preventivi\\');

  useEffect(() => {
    getNasFolderHandle().then(handle => {
      setIsNasConnected(!!handle);
    });
  }, []);

  const handleConnectNas = async () => {
    const handle = await connectNasFolder();
    if (handle) {
      setIsNasConnected(true);
      
      // Tentiamo di suggerire un percorso basato sul nome della cartella selezionata
      const folderName = handle.name;
      const suggestion = `\\\\NAS\\${folderName}\\`;
      
      // Aggiorna direttamente la radice senza prompt, come richiesto dall'utente
      localStorage.setItem('nas_root_path', suggestion);
      setNasRootPath(suggestion);
      
      if (localAttachmentName) {
        setLocalAttachmentPath(`${suggestion}${localAttachmentName}`);
      }
      
      alert(`Cartella NAS "${folderName}" connessa e impostata come radice!`);
    }
  };

  const handleViewPdf = async (path: string) => {
    try {
      setIsUploading(true);
      const file = await getFileFromNas(path);
      if (file) {
        const url = URL.createObjectURL(file);
        setViewerPdfPath(url);
        setIsViewerOpen(true);
      } else {
        alert("Impossibile trovare il file sul NAS. Verifica che la cartella NAS sia connessa e il percorso sia corretto.");
      }
    } catch (err) {
      console.error("Errore visualizzazione PDF:", err);
      alert("Errore durante l'apertura del PDF.");
    } finally {
      setIsUploading(false);
    }
  };

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
    
    if (client) {
      // Pre-fill with last attachment data if available
      setAttachmentDetails({
        date: client.attachmentDate || new Date().toISOString().split('T')[0],
        progressive: client.attachmentProgressive || '',
        amount: client.attachmentAmount ? client.attachmentAmount.toString() : ''
      });
      if (client.attachmentPath) {
        setLocalAttachmentPath(client.attachmentPath);
        setLocalAttachmentName(client.attachmentPath.split(/[\\/]/).pop() || null);
      }
    } else {
      setAttachmentDetails({
        date: new Date().toISOString().split('T')[0],
        progressive: '',
        amount: ''
      });
    }
  };

  const handleSaveAttachment = async () => {
    if (!selectedClient) return;
    if (!localAttachmentPath) {
      alert("Seleziona prima un file dal NAS!");
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

      // 3. Create a new Quotation object (Automatic creation when associating attachment)
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
        internalNotes: `Allegato PDF associato (NAS): ${localAttachmentName || 'documento.pdf'}\nPercorso: ${localAttachmentPath}`,
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

      // 5. Update the Client with the new attachment
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

      await updateClient(updatedClient.id, updatedClient);
      setSelectedClient(updatedClient);

      alert('Associazione salvata con successo e nuovo preventivo generato!');
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
                    <div className="xl:col-span-5 bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-6">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                        <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider">Associa Preventivo PDF</h4>
                        <div className="flex items-center gap-2">
                           <button
                            type="button"
                            onClick={handleConnectNas}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isNasConnected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'}`}
                            title={isNasConnected ? "NAS Connesso" : "Connetti Cartella NAS"}
                          >
                            <Settings size={14} />
                            <span>{isNasConnected ? "NAS ON" : "CONNETTI NAS"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'application/pdf';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  const root = nasRootPath;
                                  const fullPath = `${root}${file.name}`;
                                  setLocalAttachmentPath(fullPath);
                                  setLocalAttachmentName(file.name);
                                }
                              };
                              input.click();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-2 shadow-sm"
                          >
                            <FileUp size={16} />
                            <span>Sfoglia NAS...</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex-1 space-y-1 w-full">
                            <label className="text-[10px] font-bold text-blue-700 uppercase">Radice Percorso NAS</label>
                            <input 
                              type="text" 
                              placeholder="Es: \\NAS\Preventivi\"
                              className="w-full bg-white border border-blue-200 rounded px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                              value={nasRootPath}
                              onChange={(e) => {
                                const newPath = e.target.value;
                                setNasRootPath(newPath);
                                localStorage.setItem('nas_root_path', newPath);
                                if (localAttachmentName) {
                                  setLocalAttachmentPath(`${newPath}${localAttachmentName}`);
                                }
                              }}
                            />
                          </div>
                        </div>
                        {localAttachmentPath && (
                          <div className="p-2 bg-white border border-blue-200 rounded flex items-center gap-2 text-xs font-mono text-gray-700 truncate">
                            <span className="font-bold text-blue-600 shrink-0">Percorso:</span>
                            <span className="truncate">{localAttachmentPath}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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

                      <div className="pt-4 flex gap-4">
                        <button
                          type="button"
                          onClick={handleSaveAttachment}
                          disabled={!localAttachmentPath || !attachmentDetails.date || !attachmentDetails.progressive}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-lg transition-all text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check size={18} />
                          Salva Associazione
                        </button>
                      </div>
                    </div>

                    {/* Elenco Allegati (Right Panel) */}
                    <div className="xl:col-span-7 space-y-4">
                      <h4 className="font-bold text-sm text-gray-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText size={16} />
                        Allegati Associati
                      </h4>
                      
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-xs">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3">Documento / Data</th>
                              <th className="px-4 py-3">Prog. / Importo</th>
                              <th className="px-4 py-3 text-right">Azioni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {clientAttachments.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 italic">
                                  Nessun allegato trovato per questo cliente.
                                </td>
                              </tr>
                            ) : (
                              clientAttachments.map((att) => (
                                <tr key={att.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="font-bold text-blue-900 truncate max-w-[200px]" title={att.filename}>
                                      {att.filename}
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                      <FileText size={10} />
                                      {att.date ? new Date(att.date).toLocaleDateString('it-IT') : 'Data non presente'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-gray-800">
                                      {att.progressive}
                                    </div>
                                    <div className="text-xs text-green-700 font-bold">
                                      € {att.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => handleViewPdf(att.path)}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                                        title="Visualizza PDF (NAS)"
                                      >
                                        <Eye size={18} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAttachment(att.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                                        title="Elimina associazione"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                        <h5 className="text-xs font-bold text-orange-800 flex items-center gap-1.5 mb-1">
                          <Settings size={14} />
                          Istruzioni Visualizzazione NAS
                        </h5>
                        <p className="text-[10px] text-orange-700 leading-relaxed">
                          Per visualizzare i file direttamente dal NAS senza scaricarli manualmente:
                          <br />
                          1. Clicca su <strong>CONNETTI NAS</strong> e seleziona la cartella principale sul tuo PC/NAS.
                          <br />
                          2. Una volta connesso, potrai usare il tasto <Eye size={10} className="inline" /> per aprire il PDF direttamente nel visualizzatore.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 text-[10px] text-gray-500 italic flex items-center gap-1.5">
                    <Paperclip size={12} />
                    Nota: I PDF restano sul tuo NAS. Viene salvato solo il percorso per una rapida consultazione.
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
