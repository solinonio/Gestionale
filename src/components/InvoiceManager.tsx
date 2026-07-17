import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, Check, AlertCircle, UserCheck, UserPlus, 
  Search, FileText, RefreshCw, FileCode, Edit3, AlertTriangle, 
  ChevronLeft, ChevronRight, Info, Calendar, DollarSign, CheckCircle, Eye
} from 'lucide-react';
import { Invoice, Client, Quotation, InvoiceLine } from '../types';
import { getInvoices, saveInvoicesBulk, updateInvoice, deleteInvoice, getClients, addClient, updateClient, getQuotations } from '../lib/db';

interface Props {
  setActiveTab: (tab: 'home' | 'quotations' | 'anagrafiche' | 'laser' | 'ai' | 'invoices') => void;
  key?: string;
}

export default function InvoiceManager({ setActiveTab }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMatched, setFilterMatched] = useState<'all' | 'matched' | 'unmatched'>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // XML Import states
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    duplicateCount: number;
    errors: string[];
  } | null>(null);

  // Matching Modal / Editing state
  const [activeMatchingInvoice, setActiveMatchingInvoice] = useState<Invoice | null>(null);
  const [selectedClientIdForMatching, setSelectedClientIdForMatching] = useState<string>('');
  const [selectedQuotationIdForMatching, setSelectedQuotationIdForMatching] = useState<string>('');
  const [matchingSearchQuery, setMatchingSearchQuery] = useState<string>('');
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('database-synced', handleSync);
    return () => window.removeEventListener('database-synced', handleSync);
  }, []);

  const loadData = async () => {
    try {
      const [invData, clientData, qData] = await Promise.all([getInvoices(), getClients(), getQuotations()]);
      setInvoices(invData);
      setClients(clientData);
      setQuotations(qData);
    } catch (e) {
      console.error("Failed to load invoice, client or quotation data", e);
    }
  };

  // XML parsing logic using browser DOMParser
  const parseXmlInvoice = (xmlText: string, filename: string): Omit<Invoice, 'id'> | null => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Check parser error
      const parserError = xmlDoc.getElementsByTagName("parsererror");
      if (parserError.length > 0) {
        throw new Error("Errore di sintassi XML.");
      }

      // 1. Get client node (CessionarioCommittente)
      const cessionarioNodes = xmlDoc.getElementsByTagName("CessionarioCommittente");
      if (cessionarioNodes.length === 0) {
        throw new Error("Nodo CessionarioCommittente non trovato.");
      }
      const cessionario = cessionarioNodes[0];

      // Client name logic
      const denom = cessionario.getElementsByTagName("Denominazione")[0]?.textContent?.trim() || "";
      const cognome = cessionario.getElementsByTagName("Cognome")[0]?.textContent?.trim() || "";
      const nome = cessionario.getElementsByTagName("Nome")[0]?.textContent?.trim() || "";
      const clientName = denom ? denom : `${nome} ${cognome}`.trim();

      if (!clientName) {
        throw new Error("Denominazione o Nome/Cognome del cliente non definiti.");
      }

      // Client tax info
      const vatNumber = cessionario.getElementsByTagName("IdCodice")[0]?.textContent?.trim() || "";
      const cf = cessionario.getElementsByTagName("CodiceFiscale")[0]?.textContent?.trim() || "";
      const sdiCode = cessionario.getElementsByTagName("CodiceDestinatario")[0]?.textContent?.trim() || "";

      // Client address
      const address = cessionario.getElementsByTagName("Indirizzo")[0]?.textContent?.trim() || "";
      const cap = cessionario.getElementsByTagName("CAP")[0]?.textContent?.trim() || "";
      const city = cessionario.getElementsByTagName("Comune")[0]?.textContent?.trim() || "";

      // 1b. Get supplier node (CedentePrestatore)
      const cedenteNodes = xmlDoc.getElementsByTagName("CedentePrestatore");
      let supplierName = "";
      let supplierVat = "";
      let supplierCf = "";
      let supplierAddress = "";
      let supplierCap = "";
      let supplierCity = "";

      if (cedenteNodes.length > 0) {
        const cedente = cedenteNodes[0];
        const cDenom = cedente.getElementsByTagName("Denominazione")[0]?.textContent?.trim() || "";
        const cCognome = cedente.getElementsByTagName("Cognome")[0]?.textContent?.trim() || "";
        const cNome = cedente.getElementsByTagName("Nome")[0]?.textContent?.trim() || "";
        supplierName = cDenom ? cDenom : `${cNome} ${cCognome}`.trim();
        supplierVat = cedente.getElementsByTagName("IdCodice")[0]?.textContent?.trim() || "";
        supplierCf = cedente.getElementsByTagName("CodiceFiscale")[0]?.textContent?.trim() || "";
        supplierAddress = cedente.getElementsByTagName("Indirizzo")[0]?.textContent?.trim() || "";
        supplierCap = cedente.getElementsByTagName("CAP")[0]?.textContent?.trim() || "";
        supplierCity = cedente.getElementsByTagName("Comune")[0]?.textContent?.trim() || "";
      }

      // 1c. Get detailed lines (DettaglioLinee)
      const xmlLines: InvoiceLine[] = [];
      const dettaglioLineeNodes = xmlDoc.getElementsByTagName("DettaglioLinee");
      for (let i = 0; i < dettaglioLineeNodes.length; i++) {
        const node = dettaglioLineeNodes[i];
        const num = node.getElementsByTagName("NumeroLinea")[0]?.textContent?.trim() || String(i + 1);
        const description = node.getElementsByTagName("Descrizione")[0]?.textContent?.trim() || "Articolo senza descrizione";
        const quantityStr = node.getElementsByTagName("Quantita")[0]?.textContent?.trim();
        const unitPriceStr = node.getElementsByTagName("PrezzoUnitario")[0]?.textContent?.trim();
        const totalPriceStr = node.getElementsByTagName("PrezzoTotale")[0]?.textContent?.trim() || "0";
        const vatRate = node.getElementsByTagName("AliquotaIVA")[0]?.textContent?.trim() || "";

        xmlLines.push({
          num,
          description,
          quantity: quantityStr ? parseFloat(quantityStr) : undefined,
          unitPrice: unitPriceStr ? parseFloat(unitPriceStr) : undefined,
          totalPrice: parseFloat(totalPriceStr) || 0,
          vatRate
        });
      }

      // 2. Get document info
      const numero = xmlDoc.getElementsByTagName("Numero")[0]?.textContent?.trim() || "";
      const dateRaw = xmlDoc.getElementsByTagName("Data")[0]?.textContent?.trim() || ""; // YYYY-MM-DD
      const totalAmountStr = xmlDoc.getElementsByTagName("ImportoTotaleDocumento")[0]?.textContent?.trim() || "0";
      
      let totalAmount = parseFloat(totalAmountStr) || 0;

      // Fallback for amount if ImportoTotaleDocumento is not available
      if (totalAmount === 0) {
        const lineItems = xmlDoc.getElementsByTagName("PrezzoTotale");
        let sum = 0;
        for (let i = 0; i < lineItems.length; i++) {
          sum += parseFloat(lineItems[i].textContent || "0") || 0;
        }
        totalAmount = sum;
      }

      if (!numero || !dateRaw) {
        throw new Error("Numero fattura o Data non trovati.");
      }

      return {
        number: numero,
        date: dateRaw,
        totalAmount,
        clientId: null, // Will try to auto-match below
        xmlFilename: filename,
        isImported: true,
        xmlClientInfo: {
          name: clientName,
          vatNumber: vatNumber || undefined,
          cf: cf || undefined,
          sdiCode: sdiCode || undefined,
          address: address || undefined,
          cap: cap || undefined,
          city: city || undefined,
        },
        xmlSupplierInfo: supplierName ? {
          name: supplierName,
          vatNumber: supplierVat || undefined,
          cf: supplierCf || undefined,
          address: supplierAddress || undefined,
          cap: supplierCap || undefined,
          city: supplierCity || undefined,
        } : undefined,
        xmlLines: xmlLines.length > 0 ? xmlLines : undefined
      };
    } catch (err: any) {
      console.warn(`Failed to parse XML ${filename}:`, err.message);
      return null;
    }
  };

  const handleFiles = async (files: FileList) => {
    const xmlFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (xmlFiles.length === 0) {
      setImportResults({
        successCount: 0,
        duplicateCount: 0,
        errors: ["Nessun file XML valido selezionato."]
      });
      return;
    }

    const parsedInvoices: Omit<Invoice, 'id'>[] = [];
    const errors: string[] = [];
    let duplicateCount = 0;

    for (const file of xmlFiles) {
      try {
        const text = await file.text();
        const parsed = parseXmlInvoice(text, file.name);
        if (parsed) {
          // Check if already in state/local db
          const isDuplicate = invoices.some(existing => existing.xmlFilename === file.name);
          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          // Try to auto-match client in database by VAT/Partita Iva or Codice Fiscale, or exact Name
          const matchedClient = clients.find(c => {
            const hasVatMatch = parsed.xmlClientInfo.vatNumber && c.vatNumber && 
              c.vatNumber.replace(/\s+/g, '') === parsed.xmlClientInfo.vatNumber.replace(/\s+/g, '');
            const hasCfMatch = parsed.xmlClientInfo.cf && c.vatNumber && // sometimes cf is in vatNumber or sdi
              c.vatNumber.replace(/\s+/g, '') === parsed.xmlClientInfo.cf.replace(/\s+/g, '');
            const hasNameMatch = c.intestazione?.toLowerCase() === parsed.xmlClientInfo.name.toLowerCase() ||
              c.name.toLowerCase() === parsed.xmlClientInfo.name.toLowerCase();

            return hasVatMatch || hasCfMatch || hasNameMatch;
          });

          if (matchedClient) {
            parsed.clientId = matchedClient.id!;
          }

          parsedInvoices.push(parsed);
        } else {
          errors.push(`File ${file.name}: Impossibile analizzare i dati della fattura elettronica.`);
        }
      } catch (e: any) {
        errors.push(`File ${file.name}: ${e.message || "Errore sconosciuto."}`);
      }
    }

    if (parsedInvoices.length > 0) {
      const added = await saveInvoicesBulk(parsedInvoices);
      setImportResults({
        successCount: added.length,
        duplicateCount,
        errors
      });
    } else {
      setImportResults({
        successCount: 0,
        duplicateCount,
        errors
      });
    }

    loadData();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa fattura importata?")) {
      await deleteInvoice(id);
      loadData();
    }
  };

  const openMatchingPanel = (invoice: Invoice) => {
    setActiveMatchingInvoice(invoice);
    setSelectedClientIdForMatching(invoice.clientId || '');
    setMatchingSearchQuery('');
    setSelectedQuotationIdForMatching(invoice.quotationId || '');
  };

  const closeMatchingPanel = () => {
    setActiveMatchingInvoice(null);
    setSelectedClientIdForMatching('');
    setSelectedQuotationIdForMatching('');
  };

  useEffect(() => {
    if (!activeMatchingInvoice) return;
    
    if (selectedClientIdForMatching) {
      if (activeMatchingInvoice.clientId === selectedClientIdForMatching && activeMatchingInvoice.quotationId) {
        setSelectedQuotationIdForMatching(activeMatchingInvoice.quotationId);
      } else {
        const clientQuotations = quotations.filter(q => q.clientId === selectedClientIdForMatching);
        const matchingQuota = clientQuotations.find(q => Math.abs(q.totalAmount - activeMatchingInvoice.totalAmount) < 0.1);
        if (matchingQuota && matchingQuota.id) {
          setSelectedQuotationIdForMatching(matchingQuota.id);
        } else {
          setSelectedQuotationIdForMatching('');
        }
      }
    } else {
      setSelectedQuotationIdForMatching('');
    }
  }, [selectedClientIdForMatching, activeMatchingInvoice?.id]);

  const handleAssociateClient = async () => {
    if (!activeMatchingInvoice) return;
    try {
      const updated = {
        ...activeMatchingInvoice,
        clientId: selectedClientIdForMatching || null,
        quotationId: selectedQuotationIdForMatching || null
      };
      await updateInvoice(activeMatchingInvoice.id, updated);
      closeMatchingPanel();
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateClientFromXml = async () => {
    if (!activeMatchingInvoice) return;
    const { name, vatNumber, cf, sdiCode, address, cap, city } = activeMatchingInvoice.xmlClientInfo;
    try {
      const result = await addClient({
        name,
        intestazione: name,
        email: '',
        vatNumber: vatNumber || cf || '',
        sdiCode: sdiCode || '',
        address: address || '',
        cap: cap || '',
        city: city || ''
      });

      if (result && result.id) {
        const updated = {
          ...activeMatchingInvoice,
          clientId: result.id
        };
        await updateInvoice(activeMatchingInvoice.id, updated);
      }
      closeMatchingPanel();
      loadData();
    } catch (e: any) {
      alert(`Errore durante la creazione del cliente: ${e.message}`);
    }
  };

  const handleUpdateClientFromXml = async (client: Client) => {
    if (!activeMatchingInvoice) return;
    const { vatNumber, cf, sdiCode, address, cap, city } = activeMatchingInvoice.xmlClientInfo;
    try {
      const updatedClient: Client = {
        ...client,
        vatNumber: client.vatNumber || vatNumber || cf || '',
        sdiCode: client.sdiCode || sdiCode || '',
        address: client.address || address || '',
        cap: client.cap || cap || '',
        city: client.city || city || ''
      };
      
      const { id, ...clientData } = updatedClient;
      await updateClient(id, clientData);
      
      const updatedInvoiceData = {
        ...activeMatchingInvoice,
        clientId: id
      };
      await updateInvoice(activeMatchingInvoice.id, updatedInvoiceData);
      
      closeMatchingPanel();
      loadData();
    } catch (e: any) {
      alert(`Errore durante l'aggiornamento del cliente: ${e.message}`);
    }
  };

  // Search & Filters logic
  const filteredInvoices = invoices.filter(inv => {
    const matchedClient = clients.find(c => c.id === inv.clientId);
    const clientName = matchedClient ? (matchedClient.intestazione || matchedClient.name) : inv.xmlClientInfo.name;
    const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.xmlFilename.toLowerCase().includes(searchTerm.toLowerCase());

    const isMatched = !!inv.clientId;
    if (filterMatched === 'matched') return matchesSearch && isMatched;
    if (filterMatched === 'unmatched') return matchesSearch && !isMatched;
    return matchesSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Math totals for dashboard
  const totalFatturato = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const matchedCount = invoices.filter(inv => !!inv.clientId).length;
  const unmatchedCount = invoices.length - matchedCount;

  // Search for clients to match
  const filteredClientsForMatching = clients.filter(c => {
    const name = c.intestazione || c.name || '';
    return name.toLowerCase().includes(matchingSearchQuery.toLowerCase()) ||
           (c.vatNumber && c.vatNumber.includes(matchingSearchQuery));
  });

  const selectedClientDetails = clients.find(c => c.id === selectedClientIdForMatching);

  return (
    <div className="space-y-6 min-h-screen bg-gray-800 p-2 sm:p-6 text-gray-100">
      
      {/* Tab Header with version */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Gestione Fatture Emesse</h2>
          <p className="text-sm text-gray-400">Importa, confronta e associa le fatture elettroniche XML emesse</p>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-gray-400 font-semibold block uppercase">Fatturato Importato</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">€{totalFatturato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 rounded-lg">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-gray-400 font-semibold block uppercase">Fatture Totali</span>
            <span className="text-2xl font-extrabold text-blue-400 mt-1 block">{invoices.length}</span>
          </div>
          <div className="p-3 bg-blue-950/40 border border-blue-900 text-blue-400 rounded-lg">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-gray-400 font-semibold block uppercase">Clienti Associati</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-1 block">{matchedCount}</span>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 rounded-lg">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-gray-400 font-semibold block uppercase">Da Associare</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-1 block">{unmatchedCount}</span>
          </div>
          <div className="p-3 bg-amber-950/40 border border-amber-900 text-amber-400 rounded-lg">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* XML Upload Dropzone Area */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-sm">
        <h3 className="text-md font-bold text-white mb-3 uppercase tracking-wide flex items-center gap-1.5">
          <Upload size={18} className="text-blue-400" /> Carica Fatture Elettroniche (Format XML)
        </h3>

        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
            isDragging 
              ? 'border-blue-500 bg-blue-950/30' 
              : 'border-gray-700 hover:border-gray-600 bg-gray-950/30 hover:bg-gray-950/50'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }} 
            multiple 
            accept=".xml" 
            className="hidden" 
          />
          <div className="p-4 bg-gray-900 border border-gray-700 text-blue-400 rounded-full">
            <FileCode size={32} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Trascina qui i tuoi file XML di fattura elettronica, o <span className="text-blue-400 underline">sfoglia i file</span></p>
            <p className="text-xs text-gray-500 mt-1">Puoi caricare file multipli. Massimo 2MB per file.</p>
          </div>
        </div>

        {/* XML Import Results feedback */}
        {importResults && (
          <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Esito Importazione:</span>
              <button 
                onClick={() => setImportResults(null)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Chiudi Notifica
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-900 p-2 rounded-lg text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle size={14} />
                <span>Importate con successo: {importResults.successCount}</span>
              </div>
              <div className="bg-blue-950/30 border border-blue-900 p-2 rounded-lg text-blue-400 font-semibold flex items-center gap-2">
                <Info size={14} />
                <span>Saltate (Duplicate): {importResults.duplicateCount}</span>
              </div>
              {importResults.errors.length > 0 && (
                <div className="bg-rose-950/30 border border-rose-900 p-2 rounded-lg text-rose-400 font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} />
                  <span>Errori riscontrati: {importResults.errors.length}</span>
                </div>
              )}
            </div>
            {importResults.errors.length > 0 && (
              <div className="mt-2 bg-rose-950/10 border border-rose-900/30 p-2 rounded-lg max-h-24 overflow-y-auto text-[11px] text-rose-400 font-mono space-y-1">
                {importResults.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Table Panel with Filters */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-sm overflow-hidden">
        
        {/* Table Filters & Toolbar */}
        <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text"
              placeholder="Cerca per cliente, numero o file XML..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-700 bg-gray-950 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setFilterMatched('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                filterMatched === 'all' 
                  ? 'bg-blue-800 border-blue-700 text-white' 
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              Tutte
            </button>
            <button
              onClick={() => { setFilterMatched('matched'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                filterMatched === 'matched' 
                  ? 'bg-emerald-800 border-emerald-700 text-white' 
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              Solo Associate
            </button>
            <button
              onClick={() => { setFilterMatched('unmatched'); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                filterMatched === 'unmatched' 
                  ? 'bg-amber-800 border-amber-700 text-white' 
                  : 'bg-gray-950 border-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              Da Associare ({unmatchedCount})
            </button>
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-950 border-b border-gray-700 text-gray-300 text-xs uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Fattura</th>
                <th className="px-6 py-3">Data Emissione</th>
                <th className="px-6 py-3">Ragione Sociale (da XML)</th>
                <th className="px-6 py-3">Cliente Anagrafica</th>
                <th className="px-6 py-3">Importo Totale</th>
                <th className="px-6 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/50">
              {paginatedInvoices.map(inv => {
                const matchedClient = clients.find(c => c.id === inv.clientId);
                const isMatched = !!inv.clientId;
                
                return (
                  <tr key={inv.id} className="hover:bg-gray-800/40 transition-colors border-b border-gray-800">
                    <td className="px-6 py-4 font-mono text-sm text-blue-400">
                      Doc. N. {inv.number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {inv.date ? inv.date.split('-').reverse().join('/') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-semibold text-white">{inv.xmlClientInfo.name}</div>
                      <div className="text-xs text-gray-500 font-mono">P.IVA: {inv.xmlClientInfo.vatNumber || inv.xmlClientInfo.cf || 'n/d'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isMatched && matchedClient ? (
                        <div className="space-y-1.5 flex flex-col items-start">
                          <span className="inline-flex items-center gap-1 bg-emerald-950/50 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-900 text-xs font-semibold">
                            <Check size={12} />
                            {matchedClient.intestazione || matchedClient.name}
                          </span>
                          {inv.quotationId ? (() => {
                            const q = quotations.find(item => item.id === inv.quotationId);
                            if (!q) return null;
                            const isAmountMatch = Math.abs(q.totalAmount - inv.totalAmount) < 0.1;
                            return (
                              <div className="flex items-center gap-1" title={isAmountMatch ? "L'importo coincide perfettamente col preventivo" : "Attenzione: l'importo differisce da quello del preventivo"}>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${isAmountMatch ? 'bg-blue-950/50 border-blue-900 text-blue-400' : 'bg-amber-950/50 border-amber-900 text-amber-400'}`}>
                                  <FileText size={10} />
                                  Prev. N. {q.number} (€{q.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
                                </span>
                              </div>
                            );
                          })() : (
                            <div className="text-[10px] text-gray-500 font-medium italic">Nessun preventivo abbinato</div>
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => openMatchingPanel(inv)}
                          className="inline-flex items-center gap-1 bg-amber-950/50 text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-full border border-amber-900 hover:border-amber-700 text-xs font-semibold cursor-pointer transition-colors animate-pulse"
                        >
                          <AlertCircle size={12} />
                          Associa Cliente
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-extrabold text-white">
                      €{inv.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => setSelectedInvoiceForPreview(inv)}
                        className="p-1.5 bg-gray-800 text-gray-300 hover:text-emerald-400 border border-gray-700 hover:border-emerald-900 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                        title="Anteprima della fattura elettronica"
                      >
                        <Eye size={15} />
                      </button>
                      <button 
                        onClick={() => openMatchingPanel(inv)}
                        className="p-1.5 bg-gray-800 text-gray-300 hover:text-blue-400 border border-gray-700 hover:border-blue-900 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                        title="Confronta o modifica associazione cliente"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(inv.id)}
                        className="p-1.5 bg-gray-800 text-gray-300 hover:text-rose-400 border border-gray-700 hover:border-rose-900 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                        title="Rimuovi fattura"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    Nessuna fattura emessa trovata. Carica file XML in alto per iniziare.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between text-xs bg-gray-950/30">
            <span className="text-gray-400">
              Mostrate {paginatedInvoices.length} di {filteredInvoices.length} fatture emesse
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent text-gray-300 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono text-gray-300">Pagina {currentPage} di {totalPages}</span>
              <button 
                onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent text-gray-300 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Comparison & Matching Modal */}
      {activeMatchingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-700 bg-gray-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="text-blue-400" size={22} />
                <div>
                  <h3 className="text-lg font-bold text-white">Confronto ed Associazione Dati Cliente</h3>
                  <p className="text-xs text-gray-400">Associa la Fattura N. {activeMatchingInvoice.number} emessa il {activeMatchingInvoice.date?.split('-').reverse().join('/')}</p>
                </div>
              </div>
              <button 
                onClick={closeMatchingPanel}
                className="text-gray-400 hover:text-white font-bold text-sm bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            {/* Modal Content - Dual Columns Comparison */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              
              {/* Grid with XML data vs database data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* XML column */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Dati Estratti dall'XML</span>
                    <span className="text-[10px] bg-blue-950 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-900">Originale Elettronico</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 block">Ragione Sociale / Nome</span>
                      <span className="text-white font-bold">{activeMatchingInvoice.xmlClientInfo.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-500 block">Partita IVA / CF</span>
                        <span className="text-white font-mono font-semibold">{activeMatchingInvoice.xmlClientInfo.vatNumber || activeMatchingInvoice.xmlClientInfo.cf || 'n/d'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Codice SDI</span>
                        <span className="text-white font-mono font-semibold">{activeMatchingInvoice.xmlClientInfo.sdiCode || 'n/d'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">Indirizzo</span>
                      <span className="text-white">{activeMatchingInvoice.xmlClientInfo.address || 'n/d'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-gray-500 block">CAP</span>
                        <span className="text-white font-mono">{activeMatchingInvoice.xmlClientInfo.cap || 'n/d'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Comune</span>
                        <span className="text-white">{activeMatchingInvoice.xmlClientInfo.city || 'n/d'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800/80">
                    <button
                      onClick={handleCreateClientFromXml}
                      className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <UserPlus size={14} />
                      Crea Nuovo Cliente in Anagrafica con Questi Dati
                    </button>
                  </div>
                </div>

                {/* Database column */}
                <div className="bg-gray-950 border border-gray-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">Cliente Anagrafica Selezionato</span>
                      <span className="text-[10px] bg-purple-950 text-purple-300 font-semibold px-2 py-0.5 rounded border border-purple-900">Database Gestionale</span>
                    </div>

                    {/* Client Selector search and list */}
                    <div className="space-y-2">
                      <span className="text-xs text-gray-400 block">Associa ad un cliente esistente:</span>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                          type="text"
                          placeholder="Filtra clienti registrati..."
                          value={matchingSearchQuery}
                          onChange={(e) => setMatchingSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border border-gray-800 bg-gray-900 rounded-lg text-xs focus:outline-none focus:border-purple-500 text-white"
                        />
                      </div>

                      <select
                        value={selectedClientIdForMatching}
                        onChange={(e) => setSelectedClientIdForMatching(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg text-xs p-2 outline-none text-white max-h-32"
                        size={5}
                      >
                        <option value="">-- Nessun cliente associato --</option>
                        {filteredClientsForMatching.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.intestazione || c.name} {c.vatNumber ? `(P.IVA: ${c.vatNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Side-by-side data difference warnings */}
                    {selectedClientDetails && (
                      <div className="p-3.5 bg-gray-900 rounded-lg border border-gray-800 text-xs space-y-2.5">
                        <span className="font-bold text-gray-300 block">Dati correnti nel database:</span>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Nome:</span>
                            <span className="text-white font-medium text-right">{selectedClientDetails.intestazione || selectedClientDetails.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Partita IVA:</span>
                            <span className={`font-mono font-semibold ${selectedClientDetails.vatNumber !== activeMatchingInvoice.xmlClientInfo.vatNumber ? 'text-amber-400' : 'text-white'}`}>
                              {selectedClientDetails.vatNumber || 'non impostata'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Codice SDI:</span>
                            <span className={`font-mono font-semibold ${selectedClientDetails.sdiCode !== activeMatchingInvoice.xmlClientInfo.sdiCode ? 'text-amber-400 font-bold' : 'text-white'}`}>
                              {selectedClientDetails.sdiCode || 'non impostato'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Indirizzo:</span>
                            <span className="text-white text-right">{selectedClientDetails.address || 'non impostato'}</span>
                          </div>
                        </div>

                        {/* If differences are detected, show warning and option to update client */}
                        {(selectedClientDetails.sdiCode !== activeMatchingInvoice.xmlClientInfo.sdiCode || 
                          selectedClientDetails.vatNumber !== activeMatchingInvoice.xmlClientInfo.vatNumber ||
                          selectedClientDetails.address !== activeMatchingInvoice.xmlClientInfo.address) && (
                          <div className="mt-3 p-2 bg-amber-950/40 border border-amber-900 rounded text-amber-400 space-y-2">
                            <div className="flex items-start gap-1.5 font-semibold">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                              <span>Rilevate discrepanze tra i dati XML e l'anagrafica esistente!</span>
                            </div>
                            <p className="text-[10px] text-gray-300">
                              L'indirizzo, la Partita IVA o il codice SDI nell'XML differiscono o non sono registrati in anagrafica. Puoi aggiornare l'anagrafica del cliente con i nuovi dati dell'XML.
                            </p>
                            <button
                              onClick={() => handleUpdateClientFromXml(selectedClientDetails)}
                              className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-1 px-2 rounded text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={10} />
                              Sovrascrivi e Aggiorna Anagrafica con Dati XML
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quotation matching section */}
                    {selectedClientIdForMatching && (
                      <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Abbina Preventivo (Preventivi emessi)</span>
                          <span className="text-[10px] bg-amber-950 text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-900">Associazione</span>
                        </div>

                        {/* Dropdown of quotations for selected client */}
                        <div className="space-y-1.5">
                          <span className="text-xs text-gray-400 block">Seleziona preventivo emesso per questo cliente:</span>
                          <select
                            value={selectedQuotationIdForMatching}
                            onChange={(e) => setSelectedQuotationIdForMatching(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-800 rounded-lg text-xs p-2 outline-none text-white focus:border-amber-500"
                          >
                            <option value="">-- Nessun preventivo abbinato --</option>
                            {quotations
                              .filter(q => q.clientId === selectedClientIdForMatching)
                              .map(q => {
                                const isAmountMatch = Math.abs(q.totalAmount - activeMatchingInvoice.totalAmount) < 0.1;
                                return (
                                  <option key={q.id} value={q.id}>
                                    Prev. N. {q.number} ({q.date ? q.date.split('-').reverse().join('/') : ''}) - €{q.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })} {isAmountMatch ? '⭐ (Stesso Importo)' : ''}
                                  </option>
                                );
                              })}
                          </select>
                        </div>

                        {/* Display matched quotation detail */}
                        {selectedQuotationIdForMatching && (() => {
                          const selectedQuotation = quotations.find(q => q.id === selectedQuotationIdForMatching);
                          if (!selectedQuotation) return null;
                          const isAmountMatch = Math.abs(selectedQuotation.totalAmount - activeMatchingInvoice.totalAmount) < 0.1;
                          return (
                            <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${isAmountMatch ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-amber-950/20 border-amber-900 text-amber-400'}`}>
                              <div className="flex items-center justify-between font-bold">
                                <span>Dettagli Preventivo Selezionato:</span>
                                <span className="font-mono">Stato: {selectedQuotation.status}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Numero e Data:</span>
                                <span className="text-white font-medium">N. {selectedQuotation.number} del {selectedQuotation.date?.split('-').reverse().join('/')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Importo Preventivo:</span>
                                <span className="text-white font-bold">€{selectedQuotation.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Importo Fattura XML:</span>
                                <span className="text-white font-bold">€{activeMatchingInvoice.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {!isAmountMatch && (
                                <div className="text-[10px] text-amber-500 font-semibold pt-1 flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  <span>Attenzione: gli importi non coincidono esattamente!</span>
                                </div>
                              )}
                              {isAmountMatch && (
                                <div className="text-[10px] text-emerald-400 font-semibold pt-1 flex items-center gap-1">
                                  <CheckCircle size={12} />
                                  <span>Perfetto: gli importi coincidono!</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <button
                      onClick={handleAssociateClient}
                      className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <UserCheck size={14} />
                      Conferma Associazione Fattura a Questo Cliente
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-950/50 flex justify-end gap-3 text-xs">
              <button
                onClick={closeMatchingPanel}
                className="px-4 py-2 text-gray-400 hover:text-white font-medium hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                Annulla
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Electronic Invoice Preview Modal */}
      {selectedInvoiceForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white border border-gray-200 rounded-2xl shadow-2xl text-gray-900 overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between text-gray-800">
              <div className="flex items-center gap-2">
                <FileCode className="text-emerald-600" size={24} />
                <div>
                  <h3 className="text-lg font-bold">Visualizzatore Fattura Elettronica</h3>
                  <p className="text-xs text-gray-500">File XML originale: <span className="font-mono bg-gray-200 px-1.5 py-0.5 rounded text-gray-700">{selectedInvoiceForPreview.xmlFilename}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInvoiceForPreview(null)}
                className="text-gray-500 hover:text-gray-800 font-bold text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            {/* Modal Body - Printable Invoice Sheet */}
            <div className="p-8 overflow-y-auto max-h-[75vh] space-y-6 bg-gray-100">
              
              <div className="bg-white border border-gray-300 shadow-sm rounded-xl p-8 max-w-3xl mx-auto space-y-8 font-sans">
                
                {/* Invoice Sheet Header */}
                <div className="flex flex-col md:flex-row justify-between items-start border-b border-gray-200 pb-6 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded tracking-wide">Fattura Elettronica</span>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight mt-1">N. {selectedInvoiceForPreview.number}</h2>
                    <p className="text-xs text-gray-500 mt-1">Data emissione: <span className="font-semibold">{selectedInvoiceForPreview.date ? selectedInvoiceForPreview.date.split('-').reverse().join('/') : '-'}</span></p>
                  </div>
                  <div className="text-right md:text-right text-xs text-gray-500">
                    <div className="font-bold text-gray-800 uppercase">Sistema di Interscambio (SDI)</div>
                    <div>Stato documento: <span className="text-emerald-600 font-bold">Inviata / Consegnata</span></div>
                    <div>Canale: Cooperazione Applicativa (XML)</div>
                  </div>
                </div>

                {/* Sender vs Recipient */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-gray-700">
                  {/* Cedente Prestatore (Seller) */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1">Cedente Prestatore (Emittente)</h4>
                    {selectedInvoiceForPreview.xmlSupplierInfo ? (
                      <>
                        <div className="font-extrabold text-sm text-gray-900">{selectedInvoiceForPreview.xmlSupplierInfo.name}</div>
                        {selectedInvoiceForPreview.xmlSupplierInfo.address && (
                          <div>Indirizzo: {selectedInvoiceForPreview.xmlSupplierInfo.address}, {selectedInvoiceForPreview.xmlSupplierInfo.cap} {selectedInvoiceForPreview.xmlSupplierInfo.city}</div>
                        )}
                        {selectedInvoiceForPreview.xmlSupplierInfo.vatNumber && (
                          <div>Partita IVA: <span className="font-mono font-semibold">{selectedInvoiceForPreview.xmlSupplierInfo.vatNumber}</span></div>
                        )}
                        {selectedInvoiceForPreview.xmlSupplierInfo.cf && (
                          <div>Codice Fiscale: <span className="font-mono font-semibold">{selectedInvoiceForPreview.xmlSupplierInfo.cf}</span></div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-extrabold text-sm text-gray-900">Vostra Officina</div>
                        <div className="text-gray-400 italic">Dati completi emittente non inclusi nel riepilogo rapido XML</div>
                      </>
                    )}
                  </div>

                  {/* Cessionario Committente (Buyer) */}
                  <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-100 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider border-b border-emerald-100 pb-1">Cessionario Committente (Destinatario)</h4>
                    <div className="font-extrabold text-sm text-gray-900">{selectedInvoiceForPreview.xmlClientInfo.name}</div>
                    {selectedInvoiceForPreview.xmlClientInfo.address && (
                      <div>Indirizzo: {selectedInvoiceForPreview.xmlClientInfo.address}, {selectedInvoiceForPreview.xmlClientInfo.cap} {selectedInvoiceForPreview.xmlClientInfo.city}</div>
                    )}
                    {selectedInvoiceForPreview.xmlClientInfo.vatNumber && (
                      <div>Partita IVA: <span className="font-mono font-semibold">{selectedInvoiceForPreview.xmlClientInfo.vatNumber}</span></div>
                    )}
                    {selectedInvoiceForPreview.xmlClientInfo.cf && (
                      <div>Codice Fiscale: <span className="font-mono font-semibold">{selectedInvoiceForPreview.xmlClientInfo.cf}</span></div>
                    )}
                    {selectedInvoiceForPreview.xmlClientInfo.sdiCode && (
                      <div>Codice Destinatario (SDI): <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{selectedInvoiceForPreview.xmlClientInfo.sdiCode}</span></div>
                    )}
                  </div>
                </div>

                {/* Items/Lines Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dettaglio Beni e Servizi</h4>
                  
                  {!selectedInvoiceForPreview.xmlLines && (
                    <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-xs flex items-start gap-2">
                      <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                      <span>Questo documento è stato importato con una versione precedente dell'applicazione o non contiene righe dettagliate. Viene mostrato il riepilogo calcolato sul totale.</span>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-2.5 w-12 text-center">N.</th>
                          <th className="px-4 py-2.5">Descrizione delle prestazioni / beni</th>
                          <th className="px-4 py-2.5 text-center w-16">Q.tà</th>
                          <th className="px-4 py-2.5 text-right w-24">Prezzo Unit.</th>
                          <th className="px-4 py-2.5 text-center w-16">IVA %</th>
                          <th className="px-4 py-2.5 text-right w-28">Totale riga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-800">
                        {selectedInvoiceForPreview.xmlLines ? (
                          selectedInvoiceForPreview.xmlLines.map((line) => (
                            <tr key={line.num} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-center text-gray-400 font-mono font-semibold">{line.num}</td>
                              <td className="px-4 py-3 font-medium whitespace-pre-line">{line.description}</td>
                              <td className="px-4 py-3 text-center">{line.quantity !== undefined ? line.quantity : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono">{line.unitPrice !== undefined ? `€${line.unitPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}</td>
                              <td className="px-4 py-3 text-center font-mono text-gray-500">{line.vatRate ? `${parseFloat(line.vatRate)}%` : '22%'}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">€{line.totalPrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-center text-gray-400 font-mono font-semibold">1</td>
                            <td className="px-4 py-3 font-medium">Prestazione lavorativa e fornitura materiale come da documento XML emesso</td>
                            <td className="px-4 py-3 text-center">1</td>
                            <td className="px-4 py-3 text-right font-mono">€{selectedInvoiceForPreview.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-center font-mono text-gray-500">22%</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">€{selectedInvoiceForPreview.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total breakdown */}
                <div className="flex flex-col md:flex-row justify-between items-start pt-4 border-t border-gray-200 gap-4">
                  <div className="text-xs space-y-1.5 text-gray-500">
                    <div className="font-bold text-gray-700">Informazioni Associazione Gestionale:</div>
                    <div>
                      Cliente Anagrafica: {(() => {
                        const matched = clients.find(c => c.id === selectedInvoiceForPreview.clientId);
                        return matched ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle size={11} /> {matched.intestazione || matched.name}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">Non associato</span>
                        );
                      })()}
                    </div>
                    {selectedInvoiceForPreview.quotationId && (
                      <div>
                        Preventivo Collegato: {(() => {
                          const q = quotations.find(item => item.id === selectedInvoiceForPreview.quotationId);
                          return q ? (
                            <span className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                              Prev. N. {q.number} del {q.date?.split('-').reverse().join('/')} (€{q.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
                            </span>
                          ) : (
                            <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">Non trovato</span>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="w-full md:w-80 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-xs text-gray-700">
                    <div className="flex justify-between">
                      <span>Totale Imponibile:</span>
                      <span className="font-mono font-semibold">€{(selectedInvoiceForPreview.totalAmount / 1.22).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>IVA calcolata (22%):</span>
                      <span className="font-mono">€{(selectedInvoiceForPreview.totalAmount - (selectedInvoiceForPreview.totalAmount / 1.22)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm font-black text-gray-900">
                      <span>Importo Totale XML:</span>
                      <span className="font-mono text-emerald-600 text-base">€{selectedInvoiceForPreview.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs">
              <span className="text-gray-500">Documento conforme allo schema di Fatturazione Elettronica Nazionale (FatturaPA v1.2.1)</span>
              <button
                onClick={() => setSelectedInvoiceForPreview(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-xs animate-none"
              >
                Chiudi
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
