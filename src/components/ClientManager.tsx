import React, { useState, useEffect } from 'react';
import { getClients, addClient, updateClient, getQuotationsByClient, deleteClient, saveQuotation, getCompanyProfile } from '../lib/db';
import { Client, Quotation, Attachment } from '../types';
import { Plus, Search, Loader2, Trash2, Check, Paperclip, FileText, CheckCircle2, Calendar, Hash, Euro, FilePlus } from 'lucide-react';
import QuotationForm from './QuotationForm';
import AttachmentManager from './AttachmentManager';

interface Props {
  initialSelectedClientId?: string | null;
  onClearInitialSelectedClientId?: () => void;
  selectedClient?: Client | null;
  onSelectClient?: (client: Client | null) => void;
  quotations?: Quotation[];
  setQuotations?: (quotations: Quotation[]) => void;
}

export default function ClientManager({ 
  initialSelectedClientId, 
  onClearInitialSelectedClientId,
  selectedClient: propSelectedClient,
  onSelectClient,
  quotations: propQuotations,
  setQuotations: propSetQuotations
}: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [localQuotations, setLocalQuotations] = useState<Quotation[]>([]);
  const [localSelectedClient, setLocalSelectedClient] = useState<Client | null>(null);

  const selectedClient = propSelectedClient !== undefined ? propSelectedClient : localSelectedClient;
  const setSelectedClient = (client: Client | null) => {
    if (onSelectClient) {
      onSelectClient(client);
    } else {
      setLocalSelectedClient(client);
    }
  };

  const quotations = propQuotations !== undefined ? propQuotations : localQuotations;
  const setQuotations = (quots: Quotation[]) => {
    if (propSetQuotations) {
      propSetQuotations(quots);
    } else {
      setLocalQuotations(quots);
    }
  };

  const [clientForm, setClientForm] = useState<Omit<Client, 'id'>>({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '', allegati: [] });
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLetter, setFilterLetter] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // State per Creazione Preventivo Rapido con Allegato
  const [showQuickQuoteForm, setShowQuickQuoteForm] = useState(false);
  const [quickQuoteDate, setQuickQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickQuoteProgressivo, setQuickQuoteProgressivo] = useState('');
  const [quickQuoteAmount, setQuickQuoteAmount] = useState('');
  const [quickQuoteAllegati, setQuickQuoteAllegati] = useState<Attachment[]>([]);
  const [isSavingQuickQuote, setIsSavingQuickQuote] = useState(false);
  const [quickQuoteSuccessMsg, setQuickQuoteSuccessMsg] = useState<string | null>(null);

  const handleClientAttachmentsChange = async (newAttachments: Attachment[]) => {
    if (!selectedClient) return;
    const updatedClient: Client = { ...selectedClient, allegati: newAttachments };
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout (5s): il salvataggio degli allegati ha superato i 5 secondi. Il sistema è stato sbloccato. Riprova.")), 5000)
      );
      await Promise.race([
        updateClient(selectedClient.id, updatedClient),
        timeoutPromise
      ]);
      setSelectedClient(updatedClient);
      setClients(prev => prev.map(c => c.id === selectedClient.id ? updatedClient : c));
    } catch (err: any) {
      console.error("Errore/Timeout nell'aggiornamento degli allegati del cliente:", err);
      alert(err.message || "Errore durante il salvataggio degli allegati.");
    }
  };

  const handleSaveQuickQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (!quickQuoteProgressivo.trim()) {
      alert("Inserisci il progressivo del preventivo (es. 15 oppure 15/2026).");
      return;
    }

    const amountNum = parseFloat(quickQuoteAmount);
    if (isNaN(amountNum)) {
      alert("Inserisci un importo valido per il preventivo.");
      return;
    }

    setIsSavingQuickQuote(true);
    try {
      let parsedNumber = quickQuoteProgressivo.trim();
      let parsedYear = new Date().getFullYear();

      if (parsedNumber.includes('/')) {
        const parts = parsedNumber.split('/');
        parsedNumber = parts[0].trim();
        const yrStr = parts[1].trim();
        if (yrStr.length === 2) {
          parsedYear = 2000 + parseInt(yrStr);
        } else if (yrStr.length === 4) {
          parsedYear = parseInt(yrStr);
        }
      }

      const company = (await getCompanyProfile()) || {
        name: '',
        address: '',
        cap: '',
        city: '',
        phone: '',
        email: '',
        vatNumber: '',
        sdiCode: '',
        pec: '',
        presentationText: '',
        conditionsText: ''
      };

      const newQuot: Omit<Quotation, 'id'> = {
        clientId: selectedClient.id,
        number: parsedNumber,
        year: parsedYear,
        date: quickQuoteDate,
        status: 'SENT',
        totalAmount: amountNum,
        companyInfo: company,
        clientInfo: selectedClient,
        rows: [],
        notes: 'Preventivo creato da Anagrafica Cliente',
        internalNotes: '',
        internalRows: [],
        condizioni: '',
        presentationText: '',
        allegati: quickQuoteAllegati
      };

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout (5s): il salvataggio del preventivo ha superato i 5 secondi. L'allegato potrebbe essere troppo grande. Il sistema è stato sbloccato.")), 5000)
      );

      await Promise.race([
        saveQuotation(newQuot),
        timeoutPromise
      ]);

      // Refresh list of quotations for this client
      const updatedQuotations = await getQuotationsByClient(selectedClient.id);
      setQuotations(updatedQuotations);

      // Reset Quick Quote Form
      setQuickQuoteProgressivo('');
      setQuickQuoteAmount('');
      setQuickQuoteAllegati([]);
      setShowQuickQuoteForm(false);
      setQuickQuoteSuccessMsg(`Preventivo ${parsedNumber}/${parsedYear} salvato e abbinato con successo!`);
      setTimeout(() => setQuickQuoteSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Errore durante il salvataggio del preventivo rapido:", err);
      alert(err.message || "Errore durante il salvataggio del preventivo.");
    } finally {
      setIsSavingQuickQuote(false);
    }
  };

  useEffect(() => {
    if (initialSelectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === initialSelectedClientId);
      if (client) {
        setSelectedClient(client);
        setFilterLetter('ALL'); // Mostriamo l'elenco completo così il client selezionato è visibile
        getQuotationsByClient(client.id!).then(setQuotations);
        if (onClearInitialSelectedClientId) {
          onClearInitialSelectedClientId();
        }
      }
    }
  }, [initialSelectedClientId, clients, onClearInitialSelectedClientId]);

  // Registro Imprese Search State
  const [registrySearch, setRegistrySearch] = useState('');
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [showRegistryPopup, setShowRegistryPopup] = useState(false);
  const [registryPreviewData, setRegistryPreviewData] = useState<Omit<Client, 'id'>>({
    name: '',
    intestazione: '',
    email: '',
    phone: '',
    address: '',
    cap: '',
    city: '',
    vatNumber: '',
    sdiCode: ''
  });

  const handleRegistrySearch = async (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (!registrySearch.trim()) return;
    setIsSearchingRegistry(true);
    setRegistryError(null);
    try {
      const response = await fetch('/api/search-registro-imprese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: registrySearch })
      });
      const data = await response.json();
      if (data && data.success && data.azienda) {
        const az = data.azienda;
        setRegistryPreviewData({
          name: az.name || '',
          intestazione: az.name || '',
          email: az.email || '',
          phone: az.phone || '',
          address: az.address || '',
          cap: az.zipCode || '',
          city: az.city ? `${az.city}${az.province ? ` (${az.province.toUpperCase()})` : ''}` : '',
          vatNumber: az.vatNumber || '',
          sdiCode: ''
        });
        setShowRegistryPopup(true);
        setRegistrySearch('');
      } else {
        setRegistryError('Nessuna ditta trovata o errore nei dati restituiti.');
      }
    } catch (err) {
      console.error(err);
      setRegistryError('Errore di connessione o errore durante la ricerca.');
    } finally {
      setIsSearchingRegistry(false);
    }
  };

  useEffect(() => {
    const loadClients = () => {
      getClients().then(fetchedClients => {
        setClients(fetchedClients);
        if (selectedClient) {
          const current = fetchedClients.find(c => c.id === selectedClient.id);
          if (current) {
            setSelectedClient(current);
          }
        }
      });
    };
    loadClients();

    window.addEventListener('database-synced', loadClients);
    return () => {
      window.removeEventListener('database-synced', loadClients);
    };
  }, [selectedClient]);

  useEffect(() => {
    if (sessionStorage.getItem('open_new_client_form') === 'true') {
      sessionStorage.removeItem('open_new_client_form');
      setEditingClient(null);
      setClientForm({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '' });
      setShowForm(true);
    }
  }, []);

  const filters = ['ALL', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  const filteredClients = clients.filter(c => {
        const refName = c.intestazione || c.name || '';
        const matchesSearch = refName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLetter = (filterLetter === null || filterLetter === 'ALL')
          ? true
          : (filterLetter === '0-9' ? /^[0-9]/.test(refName) : refName.toUpperCase().startsWith(filterLetter));
        return matchesSearch && matchesLetter;
      });

  const handleSelectClient = async (client: Client) => {
      setSelectedClient(client);
      const quots = await getQuotationsByClient(client.id!);
      setQuotations(quots);
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClient) {
        await updateClient(editingClient.id!, {
          ...editingClient,
          ...clientForm
        });
        setEditingClient(null);
    } else {
        await addClient(clientForm);
    }
    setClientForm({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '', allegati: [] });
    setShowForm(false);
    getClients().then(setClients);
  };
  
  const handleEditClient = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditingClient(client);
    setClientForm({ name: client.name, intestazione: client.intestazione || '', email: client.email, phone: client.phone, address: client.address, cap: client.cap, city: client.city, vatNumber: client.vatNumber, sdiCode: client.sdiCode, allegati: client.allegati || [] });
    setShowForm(true);
  }

  const handleDeleteClientClick = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setClientToDelete(client);
  };

  const handleConfirmDeleteClient = async () => {
    if (clientToDelete && clientToDelete.id) {
      try {
        await deleteClient(clientToDelete.id);
        if (selectedClient && selectedClient.id === clientToDelete.id) {
          setSelectedClient(null);
          setQuotations([]);
        }
        setClientToDelete(null);
        const updated = await getClients();
        setClients(updated);
      } catch (err) {
        console.error("Errore durante la cancellazione del cliente:", err);
      }
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setIsCreating(false); setEditingQuotation(null); }} className="text-gray-600 hover:text-gray-900">&larr; Torna alla lista</button>
        <QuotationForm editingQuotation={editingQuotation || undefined} onSave={() => {
            setIsCreating(false);
            setEditingQuotation(null);
            if (selectedClient) {
              getQuotationsByClient(selectedClient.id).then(setQuotations);
            }
        }} />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">Clienti</h3>
        <button onClick={() => { setEditingClient(null); setClientForm({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '' }); setShowForm(!showForm); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={18} /> Nuovo Cliente
        </button>
      </div>
      
      <div className="mb-6 space-y-4">
        <input 
          placeholder="Cerca cliente per nome o intestazione..." 
          className="w-full p-2 border border-gray-400 rounded bg-white text-gray-900" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
        <div className="flex flex-wrap gap-1">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setFilterLetter(filterLetter === filter ? null : filter)}
              className={`px-2 py-1 border rounded text-sm ${filterLetter === filter ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSaveClient} className="mb-6 p-4 border rounded-lg bg-gray-50 grid grid-cols-2 gap-4">
          {/* Registro Imprese Search Bar */}
          <div className="col-span-2 bg-blue-50/70 p-4 rounded-lg border border-blue-200 space-y-2 mb-1">
            <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
              🔍 Ricerca Dati Azienda (RegistroImprese.it)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Inserisci nome ditta, P.IVA o codice fiscale... (es. Ferrari S.p.a.)"
                value={registrySearch}
                onChange={(e) => setRegistrySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRegistrySearch(e);
                  }
                }}
                className="flex-1 bg-white border border-blue-300 rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleRegistrySearch}
                disabled={isSearchingRegistry || !registrySearch.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2 rounded text-sm transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                {isSearchingRegistry ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ricerca...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Cerca ditta
                  </>
                )}
              </button>
            </div>
            {registryError && (
              <p className="text-xs text-rose-600 font-semibold">{registryError}</p>
            )}
            <p className="text-[10px] text-blue-700">
              💡 Inserisci la ragione sociale o la partita IVA per compilare istantaneamente tutti i campi d'anagrafica.
            </p>
          </div>

          <input 
            placeholder="Intestazione" 
            className="p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            value={clientForm.intestazione} 
            onChange={e => setClientForm({...clientForm, intestazione: e.target.value})} 
          />
          <input 
            placeholder="Ragione Sociale" 
            className={`p-2 border rounded bg-white text-gray-900 focus:outline-none focus:ring-2 ${
              !clientForm.name || !clientForm.name.trim() 
                ? 'border-red-500 bg-red-50/20 focus:ring-red-500 focus:border-red-500 placeholder-red-400' 
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`} 
            value={clientForm.name} 
            onChange={e => setClientForm({...clientForm, name: e.target.value})} 
          />
          <input placeholder="Email" className="p-2 border rounded bg-white text-gray-900" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} />
          <input placeholder="Telefono" className="p-2 border rounded bg-white text-gray-900" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
          <input placeholder="Indirizzo" className="p-2 border rounded bg-white text-gray-900" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} />
          <input placeholder="CAP" className="p-2 border rounded bg-white text-gray-900" value={clientForm.cap} onChange={e => setClientForm({...clientForm, cap: e.target.value})} />
          <input placeholder="Città" className="p-2 border rounded bg-white text-gray-900" value={clientForm.city} onChange={e => setClientForm({...clientForm, city: e.target.value})} />
          <input placeholder="P.IVA" className="p-2 border rounded bg-white text-gray-900" value={clientForm.vatNumber} onChange={e => setClientForm({...clientForm, vatNumber: e.target.value})} />
          <input placeholder="Codice Univoco" className="p-2 border rounded bg-white text-gray-900" value={clientForm.sdiCode} onChange={e => setClientForm({...clientForm, sdiCode: e.target.value})} />

          <div className="col-span-2 pt-2 border-t border-gray-200 space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Allegati Cliente</label>
            <AttachmentManager 
              attachments={clientForm.allegati || []} 
              onChange={atts => setClientForm({ ...clientForm, allegati: atts })} 
            />
          </div>

          <button type="submit" className="col-span-2 bg-green-600 text-white p-2 rounded hover:bg-green-700 cursor-pointer font-bold">{editingClient ? 'Aggiorna Cliente' : 'Salva Cliente'}</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 font-semibold text-gray-700">Intestazione</th>
              <th className="px-4 py-3 font-semibold text-gray-700">CAP / Città</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 font-semibold text-gray-700">P.IVA</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(c => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <tr 
                  key={c.id} 
                  onClick={() => handleSelectClient(c)} 
                  className={`border-b last:border-b-0 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-blue-50/70 hover:bg-blue-100/70 border-l-4 border-l-blue-600' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase tracking-wider">
                          <Check size={10} className="stroke-[3]" /> Selezionato
                        </span>
                      )}
                      <span className={isSelected ? "font-semibold text-blue-900" : ""}>{c.intestazione || c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.cap} {c.city}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.vatNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <button onClick={(e) => handleEditClient(e, c)} className="text-blue-600 hover:text-blue-800 font-medium">Aggiorna</button>
                      <button onClick={(e) => handleDeleteClientClick(e, c)} className="text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1">
                        <Trash2 size={14} /> Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedClient && (
        <div className="mt-8 space-y-6">
          {/* Scheda Allegati del Cliente */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Paperclip size={20} className="text-blue-600" />
                Scheda Allegati Cliente: <span className="text-blue-700">{selectedClient.name || selectedClient.intestazione}</span>
              </h4>
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                Gestione file salvati in anagrafica
              </span>
            </div>
            
            <AttachmentManager
              attachments={selectedClient.allegati || []}
              onChange={handleClientAttachmentsChange}
              readOnly={false}
            />
          </div>

          {/* Sezione Preventivi & Creazione Nuovo Preventivo Rapido */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-amber-600" />
                  Preventivi di {selectedClient.name || selectedClient.intestazione}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">Gestisci i preventivi esistenti o abbina un nuovo preventivo con allegati</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickQuoteForm(!showQuickQuoteForm)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={16} /> {showQuickQuoteForm ? 'Chiudi Form Rapido' : '+ Crea Preventivo con Allegato'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingQuotation(null); setIsCreating(true); }}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3 py-2 rounded-lg text-sm transition-all cursor-pointer"
                >
                  + Editor Completo
                </button>
              </div>
            </div>

            {quickQuoteSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={18} className="text-emerald-600" />
                {quickQuoteSuccessMsg}
              </div>
            )}

            {/* Form Creazione Preventivo Rapido */}
            {showQuickQuoteForm && (
              <form onSubmit={handleSaveQuickQuote} className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-200 rounded-xl space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                  <h5 className="font-bold text-base text-gray-900 flex items-center gap-2">
                    <FilePlus size={18} className="text-blue-600" />
                    Nuovo Preventivo da Abbinare al Cliente
                  </h5>
                  <span className="text-xs text-blue-700 font-medium bg-blue-100/80 px-2 py-0.5 rounded">
                    Creazione Rapida
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Calendar size={13} className="text-gray-500" /> Data Preventivo
                    </label>
                    <input
                      type="date"
                      required
                      value={quickQuoteDate}
                      onChange={e => setQuickQuoteDate(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Hash size={13} className="text-gray-500" /> Progressivo (N° o N°/Anno)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Es. 15 oppure 15/2026"
                      value={quickQuoteProgressivo}
                      onChange={e => setQuickQuoteProgressivo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Euro size={13} className="text-gray-500" /> Importo Totale (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={quickQuoteAmount}
                      onChange={e => setQuickQuoteAmount(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/80 space-y-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    Allegato / File del Preventivo
                  </label>
                  <p className="text-xs text-gray-500">
                    Carica i file PDF o le immagini associate a questo preventivo (funzionalità identica alla pagina preventivi).
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <AttachmentManager
                      attachments={quickQuoteAllegati}
                      onChange={setQuickQuoteAllegati}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickQuoteForm(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuickQuote}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow transition-all cursor-pointer"
                  >
                    {isSavingQuickQuote ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Salva e Abbina al Cliente
                  </button>
                </div>
              </form>
            )}

            {/* Tabella Preventivi del Cliente */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 font-semibold text-gray-700 text-sm">Preventivo</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-sm">Data</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-sm">Importo</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-sm">Allegati</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-sm text-right">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">
                        Nessun preventivo presente per questo cliente.
                      </td>
                    </tr>
                  ) : (
                    quotations.map((q, index) => (
                      <tr key={`${q.id}-${index}`} className="hover:bg-blue-50/60 border-b border-gray-200 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          N° {q.number}/{q.year % 100}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{q.date}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          €{(q.totalAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {q.allegati && q.allegati.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
                              <Paperclip size={12} /> {q.allegati.length} file
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Nessun file</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setEditingQuotation(q); setIsCreating(true); }}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm cursor-pointer"
                          >
                            Apri / Modifica
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Registry Search Preview Popup Modal */}
      {showRegistryPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 max-w-xl w-full overflow-hidden text-gray-900 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Search size={20} className="text-amber-400" />
                Dati Azienda Trovati - Verifica e Modifica
              </h3>
              <button
                type="button"
                onClick={() => setShowRegistryPopup(false)}
                className="text-white/80 hover:text-white font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Editable Fields Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-gray-600">
                I dati sottostanti sono stati recuperati da Registro Imprese. Puoi modificarli prima di importarli definitivamente nella scheda del nuovo cliente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Intestazione */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Intestazione</label>
                  <input
                    type="text"
                    value={registryPreviewData.intestazione}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, intestazione: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                {/* Ragione Sociale */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Ragione Sociale (Nome Completo)</label>
                  <input
                    type="text"
                    value={registryPreviewData.name}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Email / PEC</label>
                  <input
                    type="email"
                    value={registryPreviewData.email}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Telefono */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Telefono</label>
                  <input
                    type="text"
                    value={registryPreviewData.phone}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, phone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Indirizzo */}
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Indirizzo Sede Legale</label>
                  <input
                    type="text"
                    value={registryPreviewData.address}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, address: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* CAP */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">CAP</label>
                  <input
                    type="text"
                    value={registryPreviewData.cap}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, cap: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Città */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Città / Prov</label>
                  <input
                    type="text"
                    value={registryPreviewData.city}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, city: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Partita IVA */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Partita IVA / C.F.</label>
                  <input
                    type="text"
                    value={registryPreviewData.vatNumber}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, vatNumber: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Codice Univoco / SDI */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Codice Univoco (SDI)</label>
                  <input
                    type="text"
                    value={registryPreviewData.sdiCode}
                    onChange={(e) => setRegistryPreviewData({ ...registryPreviewData, sdiCode: e.target.value })}
                    placeholder="Es. M5UXCR1"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowRegistryPopup(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientForm({ ...registryPreviewData });
                  setShowRegistryPopup(false);
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Importa nella scheda d'anagrafica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conferma Cancellazione Cliente */}
      {clientToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 max-w-md w-full overflow-hidden text-gray-900">
            <div className="bg-rose-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Trash2 size={20} />
                Conferma Eliminazione
              </h3>
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="text-white/80 hover:text-white font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Sei sicuro di voler eliminare il cliente <strong className="text-gray-950">{clientToDelete.name || clientToDelete.intestazione}</strong>?
              </p>
              <p className="text-xs text-rose-600 font-semibold">
                ⚠️ Questa azione è irreversibile e rimuoverà il cliente dall'elenco.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClient}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-all cursor-pointer shadow-sm"
              >
                Elimina Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
