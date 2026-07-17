import React, { useState, useEffect } from 'react';
import { Plus, FileText, Users, Search, ChevronLeft, ChevronRight, Github, Shield, UserPlus, Trash2, Eye, EyeOff, FileCode } from 'lucide-react';
import { Quotation, Client, User, UserRole, Invoice } from '../types';
import { getQuotations, getClients, getUsers, addUser, deleteUser, getInvoices } from '../lib/db';
import Simulator from './Simulator';

interface Props {
  setActiveTab: (tab: 'home' | 'quotations' | 'anagrafiche' | 'laser' | 'ai' | 'invoices' | 'materiali') => void;
  onNewQuotation: () => void;
  onEditQuotation: (q: Quotation) => void;
  onOpenSync: () => void;
  onSelectClient: (clientId: string) => void;
  currentUser: User | null;
  key?: string;
}

export default function Home({ setActiveTab, onNewQuotation, onEditQuotation, onOpenSync, onSelectClient, currentUser }: Props) {
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState<string>('Tutti');
  const [selectedInvoiceYear, setSelectedInvoiceYear] = useState<string>('Tutti');
  const [selectedQuotationStatsYear, setSelectedQuotationStatsYear] = useState<string>('Tutti');
  const itemsPerPage = 10;
  const clientsPerPage = 5;

  // User Management State
  const [usersList, setUsersList] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('COLLABORATORE');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [userError, setUserError] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      const loadUsers = () => {
        getUsers().then(setUsersList);
      };
      loadUsers();
      window.addEventListener('database-synced', loadUsers);
      return () => {
        window.removeEventListener('database-synced', loadUsers);
      };
    }
  }, [currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!newUsername.trim() || !newPassword.trim()) {
      setUserError('Nome utente e password sono richiesti.');
      return;
    }
    const exists = usersList.some(u => u.username.toLowerCase() === newUsername.trim().toLowerCase());
    if (exists) {
      setUserError('Questo nome utente esiste già.');
      return;
    }
    try {
      await addUser({
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole
      });
      setNewUsername('');
      setNewPassword('');
      getUsers().then(setUsersList);
    } catch (err: any) {
      setUserError(err.message || 'Errore durante la creazione.');
    }
  };

  const handleDeleteUserClick = (user: User) => {
    if (user.username === 'OldGame') return;
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
      getUsers().then(setUsersList);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const [quotations, clients, invoices] = await Promise.all([getQuotations(), getClients(), getInvoices()]);
      
      // Sort all quotations by number desc
      const sortedQuotations = [...quotations].sort((a, b) => parseInt(b.number) - parseInt(a.number));
      setAllQuotations(sortedQuotations);

      // Recent Clients from latest quotations
      const recentClientIds = [...new Set(sortedQuotations.slice(0, 5).map(q => q.clientId))];
      const recent = recentClientIds
        .map(id => clients.find(c => c.id === id))
        .filter((c): c is Client => !!c)
        .slice(0, 5);
      setRecentClients(recent);
      
      setAllClients(clients);
      setAllInvoices(invoices);
    }
    fetchData();

    const handleSync = () => {
      fetchData();
    };
    window.addEventListener('database-synced', handleSync);
    return () => {
      window.removeEventListener('database-synced', handleSync);
    };
  }, []);

  const filteredClients = allClients.filter(c => {
    const refName = c.intestazione || c.name || '';
    return refName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const activeClientsList = searchTerm ? filteredClients : allClients;
  const totalClientPages = Math.ceil(activeClientsList.length / clientsPerPage);
  const paginatedClients = activeClientsList.slice((clientPage - 1) * clientsPerPage, clientPage * clientsPerPage);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setClientPage(1);
  };

  const availableYears = Array.from(
    new Set(allQuotations.map(q => String(q.year)))
  ) as string[];

  availableYears.sort((a, b) => b.localeCompare(a));

  const filteredQuotations = allQuotations.filter(q => {
    if (selectedYear === 'Tutti') return true;
    return q.year.toString() === selectedYear;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
  const paginatedQuotations = filteredQuotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const getInvoiceYear = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts[0] && parts[0].length === 4) return parts[0];
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts[2] && parts[2].length === 4) return parts[2];
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d.getFullYear().toString();
    } catch (e) {}
    return '';
  };

  const availableInvoiceYears = Array.from(
    new Set(allInvoices.map(inv => getInvoiceYear(inv.date)).filter(Boolean))
  ) as string[];
  availableInvoiceYears.sort((a, b) => b.localeCompare(a));

  const availableQuotationStatsYears = Array.from(
    new Set(allQuotations.map(q => String(q.year)).filter(Boolean))
  ) as string[];
  availableQuotationStatsYears.sort((a, b) => b.localeCompare(a));

  const filteredInvoicesForStats = allInvoices.filter(inv => {
    if (selectedInvoiceYear === 'Tutti') return true;
    return getInvoiceYear(inv.date) === selectedInvoiceYear;
  });

  const filteredQuotationsForStats = allQuotations.filter(q => {
    if (selectedQuotationStatsYear === 'Tutti') return true;
    return String(q.year) === selectedQuotationStatsYear;
  });

  const totalFatturato = filteredInvoicesForStats.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalPreventiviValue = filteredQuotationsForStats.reduce((sum, q) => sum + q.totalAmount, 0);

  return (
    <div className="space-y-6 min-h-screen bg-gray-800 p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
      </div>

      {/* Dashboard Stats Row */}
      {currentUser?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="bg-gray-900 border border-gray-700 p-5 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider truncate">Fatturato (Fatture XML)</span>
                <select
                  value={selectedInvoiceYear}
                  onChange={(e) => setSelectedInvoiceYear(e.target.value)}
                  className="bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-1.5 py-0.5 text-[11px] font-semibold focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="Tutti">Tutti gli anni</option>
                  {availableInvoiceYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              <span className="text-2xl font-extrabold text-emerald-400 block truncate">
                €{totalFatturato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {selectedInvoiceYear === 'Tutti' 
                  ? `Su ${allInvoices.length} fatture totali` 
                  : `Su ${filteredInvoicesForStats.length} di ${allInvoices.length} fatture nel ${selectedInvoiceYear}`
                }
              </span>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 rounded-lg cursor-pointer hover:bg-emerald-950/65 transition-colors shrink-0" onClick={() => setActiveTab('invoices')} title="Vai alle Fatture">
              <FileCode size={20} />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 p-5 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider truncate">Preventivi Emessi</span>
                <select
                  value={selectedQuotationStatsYear}
                  onChange={(e) => setSelectedQuotationStatsYear(e.target.value)}
                  className="bg-gray-800 text-gray-300 border border-gray-700 rounded-md px-1.5 py-0.5 text-[11px] font-semibold focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Tutti">Tutti gli anni</option>
                  {availableQuotationStatsYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              <span className="text-2xl font-extrabold text-blue-400 block truncate">
                €{totalPreventiviValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {selectedQuotationStatsYear === 'Tutti'
                  ? `Su ${allQuotations.length} preventivi totali`
                  : `Su ${filteredQuotationsForStats.length} di ${allQuotations.length} preventivi nel ${selectedQuotationStatsYear}`
                }
              </span>
            </div>
            <div className="p-3 bg-blue-950/40 border border-blue-900 text-blue-400 rounded-lg cursor-pointer hover:bg-blue-950/65 transition-colors shrink-0" onClick={() => setActiveTab('quotations')} title="Vai ai Preventivi">
              <FileText size={20} />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-700 p-5 rounded-xl flex items-center justify-between shadow-xs">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider mb-1">Clienti Registrati</span>
              <span className="text-2xl font-extrabold text-purple-400 block">
                {allClients.length} ditte
              </span>
              <span className="text-[10px] text-gray-400 mt-1 block">In anagrafica clienti generale</span>
            </div>
            <div className="p-3 bg-purple-950/40 border border-purple-900 text-purple-400 rounded-lg cursor-pointer hover:bg-purple-950/65 transition-colors shrink-0" onClick={() => setActiveTab('anagrafiche')} title="Vai alle Anagrafiche">
              <Users size={20} />
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-200 p-6 rounded-xl border border-gray-300 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <FileText className="text-blue-700" size={20} /> Tutti i Preventivi
              </h3>
              <button 
                onClick={onNewQuotation}
                className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 text-sm font-semibold transition-all cursor-pointer shadow-sm"
              >
                <Plus size={16} /> Nuovo Preventivo
              </button>
            </div>

            {/* Tab Navigation per Anno */}
            <div className="flex border-b border-gray-300 gap-1 overflow-x-auto pb-1 mb-4">
              <button
                onClick={() => handleYearChange('Tutti')}
                className={`px-3 py-1.5 font-bold text-xs transition-all border-b-2 -mb-[5px] whitespace-nowrap ${
                  selectedYear === 'Tutti'
                    ? 'border-blue-700 text-blue-950 bg-gray-300/80 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-300/20 rounded-t-lg'
                }`}
              >
                Tutti i Preventivi
              </button>
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => handleYearChange(yr)}
                  className={`px-3 py-1.5 font-bold text-xs transition-all border-b-2 -mb-[5px] whitespace-nowrap ${
                    selectedYear === yr
                      ? 'border-blue-700 text-blue-950 bg-gray-300/80 rounded-t-lg'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-300/20 rounded-t-lg'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
            
            <table className="w-full text-sm text-left">
              <thead className="text-gray-600 border-b border-gray-300">
                <tr>
                  <th className="pb-3">Numero</th>
                  <th className="pb-3">Cliente</th>
                  <th className="pb-3 text-right">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {paginatedQuotations.map(q => (
                  <tr 
                    key={q.id} 
                    onClick={() => onEditQuotation(q)}
                    className="hover:bg-gray-300 cursor-pointer border-b border-gray-300 last:border-b-0 transition-colors"
                  >
                    <td className="py-3 font-medium text-blue-800 underline">{q.number}/{q.year}</td>
                    <td className="py-3 text-gray-900">{q.clientInfo.intestazione || q.clientInfo.name}</td>
                    <td className="py-3 text-right text-gray-900 font-medium">€{q.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredQuotations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-600 font-medium">Nessun preventivo trovato per l'anno selezionato</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t border-gray-300">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-gray-900"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-gray-900 font-medium">Pagina {currentPage} di {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-gray-900"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-200 p-6 rounded-xl border border-gray-300 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium flex items-center gap-2 text-gray-900">
                <Users className="text-purple-700" size={20} /> Anagrafiche Clienti
              </h3>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text"
                placeholder="Cerca ditta o cliente..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-400 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 placeholder-gray-500"
              />
            </div>

            <table className="w-full text-sm text-left">
              <thead className="text-gray-600 border-b border-gray-300">
                <tr>
                  <th className="pb-3">Nome / Ragione Sociale</th>
                  <th className="pb-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {paginatedClients.map(c => (
                  <tr 
                    key={c.id}
                    onClick={() => onSelectClient(c.id!)}
                    className="hover:bg-gray-300 cursor-pointer border-b border-gray-300 last:border-b-0 transition-colors"
                  >
                    <td className="py-3 font-medium text-purple-900 underline">{c.intestazione || c.name}</td>
                    <td className="py-3 text-gray-700">{c.email}</td>
                  </tr>
                ))}
                {paginatedClients.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-gray-600 font-medium">Nessun cliente trovato</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls for clients */}
          {totalClientPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6 pt-4 border-t border-gray-300">
              <button 
                onClick={() => setClientPage(prev => Math.max(prev - 1, 1))}
                disabled={clientPage === 1}
                className="p-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-gray-900"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-gray-900 font-medium">Pagina {clientPage} di {totalClientPages}</span>
              <button 
                onClick={() => setClientPage(prev => Math.min(prev + 1, totalClientPages))}
                disabled={clientPage === totalClientPages}
                className="p-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-gray-900"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Simulator showAddButtons={false} />
      </div>

      {currentUser?.role === 'ADMIN' && (
        <div className="mt-8 bg-gray-200 p-6 rounded-xl border border-gray-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <Shield className="text-blue-700" size={20} /> Gestione Utenti Gestionali (Area Admin)
            </h3>
            <p className="text-xs text-gray-600 font-semibold bg-blue-100 border border-blue-200 rounded px-2 py-1">
              Solo gli Amministratori possono visualizzare e gestire questa scheda.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form per aggiungere utente */}
            <div className="bg-white p-5 rounded-lg border border-gray-300 shadow-xs">
              <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                <UserPlus size={16} className="text-blue-700" /> Nuovo Utente
              </h4>
              <form onSubmit={handleCreateUser} className="space-y-3.5">
                {userError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
                    {userError}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="es. michele_laser"
                    className="w-full p-2 border border-gray-300 rounded text-sm text-gray-950 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Scegli password"
                      className="w-full p-2 pr-9 border border-gray-300 rounded text-sm text-gray-950 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-600">Ruolo</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full p-2 border border-gray-300 rounded text-sm text-gray-950 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="COLLABORATORE">COLLABORATORE (Solo Dashboard e Laser)</option>
                    <option value="ADMIN">ADMIN (Accesso a Tutto & Gestione Utenti)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold p-2 text-sm rounded transition-all cursor-pointer shadow-xs"
                >
                  Crea Utente
                </button>
              </form>
            </div>

            {/* Lista utenti */}
            <div className="bg-white p-5 rounded-lg border border-gray-300 shadow-xs lg:col-span-2 overflow-x-auto">
              <h4 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide">
                Utenti Registrati ({usersList.length})
              </h4>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-600 text-xs uppercase font-semibold">
                    <th className="pb-2.5">Username</th>
                    <th className="pb-2.5">Password</th>
                    <th className="pb-2.5">Ruolo</th>
                    <th className="pb-2.5 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usersList.map((usr) => (
                    <tr key={usr.id} className="text-gray-900">
                      <td className="py-2.5 font-semibold text-gray-950">{usr.username}</td>
                      <td className="py-2.5 font-mono text-xs">{usr.password}</td>
                      <td className="py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          usr.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}>
                          {usr.role}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {usr.username !== 'OldGame' ? (
                          <button
                            onClick={() => handleDeleteUserClick(usr)}
                            className="text-rose-600 hover:text-rose-800 font-semibold text-xs flex items-center gap-1 ml-auto"
                            title="Elimina Utente"
                          >
                            <Trash2 size={14} /> Elimina
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">Predefinito (Protetto)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conferma Cancellazione Utente */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-300 max-w-md w-full overflow-hidden text-gray-900">
            <div className="bg-rose-700 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Trash2 size={20} />
                Conferma Eliminazione Utente
              </h3>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="text-white/80 hover:text-white font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Sei sicuro di voler eliminare l'utente <strong className="text-gray-950">{userToDelete.username}</strong>?
              </p>
              <p className="text-xs text-rose-600 font-semibold">
                ⚠️ Questo utente non potrà più effettuare il login al gestionale.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-all cursor-pointer shadow-sm"
              >
                Elimina Utente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
