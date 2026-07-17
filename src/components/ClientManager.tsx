import React, { useState, useEffect } from 'react';
import { getClients, addClient, updateClient, getQuotationsByClient, deleteClient } from '../lib/db';
import { Client, Quotation } from '../types';
import { Plus, Search, Loader2, Trash2, Check } from 'lucide-react';
import QuotationForm from './QuotationForm';

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

  const [clientForm, setClientForm] = useState<Omit<Client, 'id'>>({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLetter, setFilterLetter] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

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
    console.log('Fetching clients in ClientManager...');
    const loadClients = () => {
      getClients().then(clients => {
        console.log('Clients fetched in ClientManager:', clients);
        setClients(clients);
      });
    };
    loadClients();

    window.addEventListener('database-synced', loadClients);
    return () => {
      window.removeEventListener('database-synced', loadClients);
    };
  }, []);

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
    setClientForm({ name: '', intestazione: '', email: '', phone: '', address: '', cap: '', city: '', vatNumber: '', sdiCode: '' });
    setShowForm(false);
    getClients().then(setClients);
  };
  
  const handleEditClient = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditingClient(client);
    setClientForm({ name: client.name, intestazione: client.intestazione || '', email: client.email, phone: client.phone, address: client.address, cap: client.cap, city: client.city, vatNumber: client.vatNumber, sdiCode: client.sdiCode });
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
          <div className="mt-8">
              <h4 className="font-bold text-lg mb-4">Preventivi di {selectedClient.name || selectedClient.intestazione}</h4>
              <button onClick={() => { setEditingQuotation(null); setIsCreating(true); }} className="text-blue-600 mb-2">+ Nuovo Preventivo</button>
              <table className="w-full text-left border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 font-semibold text-gray-700">Preventivo</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Data</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">Importo</th>
                    </tr>
                  </thead>
                  <tbody>
                      {quotations.map((q, index) => (
                          <tr key={`${q.id}-${index}`} onClick={() => { setEditingQuotation(q); setIsCreating(true); }} className="cursor-pointer hover:bg-blue-50 border-b border-gray-200">
                              <td className="px-4 py-3">{q.number}/{q.year % 100}</td>
                              <td className="px-4 py-3">{q.date}</td>
                              <td className="px-4 py-3">€{q.totalAmount.toFixed(2)}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
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
