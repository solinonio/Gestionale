import React, { useState, useEffect } from 'react';
import { getQuotations, deleteQuotation, saveQuotation, getClients, getCompanyProfile } from '../lib/db';
import { Quotation } from '../types';
import QuotationForm from './QuotationForm';
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Paperclip, BarChart2, TrendingUp, Filter, Check, Sliders, Info, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts';

interface Props {
  setActiveTab: (tab: 'quotations' | 'anagrafiche' | null) => void;
  initialCreating?: boolean;
  initialEditingQuotation?: Quotation | null;
  onClearInitialEditing?: () => void;
  key?: string;
}

export default function QuotationManager({ setActiveTab, initialCreating, initialEditingQuotation, onClearInitialEditing }: Props) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isCreating, setIsCreating] = useState(initialCreating || !!initialEditingQuotation || false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(initialEditingQuotation || null);

  useEffect(() => {
    if (initialCreating !== undefined) {
      setIsCreating(initialCreating || !!initialEditingQuotation);
    }
    if (initialEditingQuotation !== undefined) {
      setEditingQuotation(initialEditingQuotation);
    }
  }, [initialCreating, initialEditingQuotation]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNumber, setFilterNumber] = useState('');
  const [filterIntestazione, setFilterIntestazione] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState<number | 'Tutti'>('Tutti');
  const itemsPerPage = 10;

  // Sorting state for quotations table
  const [sortField, setSortField] = useState<'number' | 'date' | 'client'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'number' | 'date' | 'client') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to descending when changing fields
    }
    setCurrentPage(1);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'info' | 'error', text: string } | null>(null);

  const handleSyncAttachments = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      // 1. Fetch all clients
      const clientsList = await getClients();
      
      // 2. Fetch the company profile info for defaults
      const companyInfo = await getCompanyProfile() || {
        name: '', address: '', cap: '', city: '', phone: '', email: '', vatNumber: '', sdiCode: '', pec: '',
        presentationText: '', conditionsText: ''
      };

      // 3. Fetch latest quotations to make sure we compare accurately
      const currentQuotations = await getQuotations();

      let addedCount = 0;

      // 4. Iterate over each client
      for (const client of clientsList) {
        // Collect ALL attachments from this client (both array and legacy single fields)
        const allClientAttachments: {
          id: string;
          path: string;
          filename: string;
          date: string;
          progressive: string;
          amount: number;
        }[] = [];

        // Check legacy single attachment fields
        if (
          client.attachmentPath &&
          client.attachmentDate &&
          client.attachmentProgressive &&
          client.attachmentAmount &&
          parseFloat(client.attachmentAmount.toString()) > 0
        ) {
          allClientAttachments.push({
            id: 'legacy-attachment',
            path: client.attachmentPath,
            filename: client.attachmentPath.split('/').pop() || 'Documento PDF',
            date: client.attachmentDate,
            progressive: client.attachmentProgressive,
            amount: parseFloat(client.attachmentAmount.toString())
          });
        }

        // Check modern attachments array
        if (client.attachments && client.attachments.length > 0) {
          for (const att of client.attachments) {
            if (att.path && att.date && att.progressive && att.amount) {
              const amountNum = parseFloat(att.amount.toString());
              if (amountNum > 0 && !allClientAttachments.some(x => x.path === att.path)) {
                allClientAttachments.push({
                  id: att.id,
                  path: att.path,
                  filename: att.filename || 'Documento PDF',
                  date: att.date,
                  progressive: att.progressive,
                  amount: amountNum
                });
              }
            }
          }
        }

        if (allClientAttachments.length === 0) continue;

        for (const att of allClientAttachments) {
          // Double check if this attachment already has a matching quotation in the database
          // Match by client ID, number/progressive, and date OR by exact attachment path
          const alreadyExists = currentQuotations.some(q => 
            (q.clientId === client.id && q.number === att.progressive && q.date === att.date) ||
            (q.attachment === att.path)
          );

          if (!alreadyExists) {
            // Re-parse the year for safety
            const parsedYear = new Date(att.date).getFullYear() || new Date().getFullYear();

            const newQuotation = {
              clientId: client.id,
              number: att.progressive,
              year: parsedYear,
              status: 'DRAFT' as const,
              date: att.date,
              totalAmount: att.amount,
              companyInfo: companyInfo,
              clientInfo: client,
              rows: [
                {
                  id: Date.now().toString(36) + "-r1-" + Math.random().toString(36).substring(2, 5),
                  description: `PREVENTIVO ALLEGATO - PROG. ${att.progressive} - PDF: ${att.filename}`,
                  quantity: 1,
                  price: att.amount,
                  discount: null,
                  isDescriptionOnly: false,
                  isOmaggio: false
                }
              ],
              notes: `Generato automaticamente dalla sincronizzazione degli allegati PDF in Anagrafiche.`,
              internalNotes: `Allegato PDF associato: ${att.filename}\nPercorso: ${att.path}`,
              internalRows: [],
              condizioni: companyInfo.conditionsText || '',
              presentationText: companyInfo.presentationText || '',
              showTotal: true,
              attachment: att.path,
              attachmentDate: att.date,
              attachmentProgressive: att.progressive,
              attachmentAmount: att.amount,
              isImported: true
            };

            await saveQuotation(newQuotation);
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        setSyncStatusMsg({
          type: 'success',
          text: `Sincronizzazione completata! Aggiunti ${addedCount} nuovi preventivi dagli allegati dei clienti.`
        });
        // Reload quotations
        const refreshed = await getQuotations();
        setQuotations(refreshed);
      } else {
        setSyncStatusMsg({
          type: 'info',
          text: 'Tutti gli allegati dei clienti sono già sincronizzati nella tabella preventivi.'
        });
      }
    } catch (error) {
      console.error('Errore durante la sincronizzazione:', error);
      setSyncStatusMsg({
        type: 'error',
        text: 'Si è verificato un errore durante la sincronizzazione degli allegati.'
      });
    } finally {
      setIsSyncing(false);
      // Auto clear message after 5 seconds
      setTimeout(() => {
        setSyncStatusMsg(null);
      }, 5000);
    }
  };

  useEffect(() => {
    const loadData = () => {
      getQuotations().then(data => {
        setQuotations(data);
      });
    };
    loadData();

    window.addEventListener('database-synced', loadData);
    return () => {
      window.removeEventListener('database-synced', loadData);
    };
  }, []);
  
  const handleDuplicate = async (q: Quotation, e: React.MouseEvent) => {
      e.stopPropagation();
      const allQuotations = await getQuotations();
      const year = q.year || new Date().getFullYear();
      
      const baseNumber = q.number.includes('/') ? q.number.split('/')[0].trim() : q.number.trim();
      
      const sameYearNumbers = allQuotations
          .filter(quot => quot.year === year)
          .map(quot => (quot.number || '').trim());
      
      const getLetterForIndex = (index: number): string => {
          let temp = index;
          let letter = '';
          while (temp >= 0) {
              letter = String.fromCharCode((temp % 26) + 65) + letter;
              temp = Math.floor(temp / 26) - 1;
          }
          return letter;
      };
      
      let letterIndex = 0;
      let candidateNumber = '';
      while (true) {
          const letter = getLetterForIndex(letterIndex);
          candidateNumber = `${baseNumber}/${letter}`;
          if (!sameYearNumbers.includes(candidateNumber)) {
              break;
          }
          letterIndex++;
      }
      
      const duplicatedQuotation: Omit<Quotation, 'id'> = {
          ...q,
          number: candidateNumber,
          year: year,
          date: new Date().toISOString().split('T')[0],
          status: 'DRAFT',
      };
      
      await saveQuotation(duplicatedQuotation);
      const updatedQuotations = await getQuotations();
      setQuotations(updatedQuotations.sort((a, b) => parseInt(b.number) - parseInt(a.number)));
  }

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(id);
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null); // Close modal

    // Optimistic update
    setQuotations(prev => prev.filter(q => q.id !== id));
    
    try {
        await deleteQuotation(id);
        console.log('Quotation deleted successfully');
    } catch (error) {
        console.error('Failed to delete, reverting state');
        // Re-fetch to revert if deletion fails
        getQuotations().then(setQuotations);
    }
  }

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  }

  // Extract all unique years from quotations
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const filteredQuotations = quotations
    .filter(q => {
      const clientName = q.clientInfo?.intestazione || q.clientInfo?.name || '';
      const qNumber = q.number || '';
      const qDate = q.date || '';

      const matchSearch = searchQuery === '' || 
        clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        qNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchNumber = filterNumber === '' || 
        qNumber.toLowerCase().includes(filterNumber.toLowerCase());

      const matchIntestazione = filterIntestazione === '' || 
        clientName.toLowerCase().includes(filterIntestazione.toLowerCase());

      const matchDate = filterDate === '' || 
        qDate.includes(filterDate);

      const matchYear = selectedYear === 'Tutti' || q.year === selectedYear;

      return matchSearch && matchNumber && matchIntestazione && matchDate && matchYear;
    })
    .sort((a, b) => {
      if (sortField === 'date') {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return sortDirection === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      } else if (sortField === 'client') {
        const clientA = a.clientInfo?.intestazione || a.clientInfo?.name || '';
        const clientB = b.clientInfo?.intestazione || b.clientInfo?.name || '';
        return sortDirection === 'asc' ? clientA.localeCompare(clientB) : clientB.localeCompare(clientA);
      } else { // sortField === 'number'
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        if (numA !== numB) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const strA = a.number || '';
        const strB = b.number || '';
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      }
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
  const paginatedQuotations = filteredQuotations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const availableYears = Array.from(new Set(quotations.map(q => q.year).filter(Boolean))) as number[];
  availableYears.sort((a, b) => Number(b) - Number(a));
  
  // Nuovi stati per grafici avanzati ed abilitazione/disabilitazione campi
  const [chartTab, setChartTab] = useState<'annual' | 'correlation'>('annual');
  const [showTotale, setShowTotale] = useState(true);
  const [showPreventivi, setShowPreventivi] = useState(true);
  const [showCostoMedio, setShowCostoMedio] = useState(true);
  
  // Filtri e personalizzazioni per la correlazione
  const [minPreventiviFilter, setMinPreventiviFilter] = useState<number>(1);
  const [excludedClients, setExcludedClients] = useState<string[]>([]);
  const [correlationMetric, setCorrelationMetric] = useState<'costoMedio' | 'totale'>('costoMedio');

  // Calcolo totali, conteggio preventivi e importo medio per anno
  const yearlyData = availableYears.map(year => {
      const yearQuotations = quotations.filter(q => q.year === year);
      const totale = yearQuotations.reduce((sum, q) => sum + q.totalAmount, 0);
      const preventivi = yearQuotations.length;
      const media = preventivi > 0 ? parseFloat((totale / preventivi).toFixed(2)) : 0;
      return {
          year: year,
          totale: parseFloat(totale.toFixed(2)),
          preventivi: preventivi,
          media: media
      };
  }).sort((a, b) => a.year - b.year);

  // Calcolo dati correlazione a livello di cliente
  const allClientCorrelationData = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; total: number }>();
    quotations.forEach(q => {
      const name = q.clientInfo?.intestazione || q.clientInfo?.name || 'Sconosciuto';
      const key = q.clientId || name;
      const current = map.get(key) || { id: key, name, count: 0, total: 0 };
      current.count += 1;
      current.total += q.totalAmount;
      map.set(key, current);
    });

    return Array.from(map.values()).map(c => ({
      id: c.id,
      name: c.name,
      count: c.count,
      costoMedio: c.count > 0 ? parseFloat((c.total / c.count).toFixed(2)) : 0,
      totale: parseFloat(c.total.toFixed(2))
    })).sort((a, b) => b.count - a.count);
  }, [quotations]);

  // Dati di correlazione filtrati in base all'esclusione o filtro minimo
  const filteredClientCorrelationData = React.useMemo(() => {
    return allClientCorrelationData.filter(
      c => c.count >= minPreventiviFilter && !excludedClients.includes(c.id)
    );
  }, [allClientCorrelationData, minPreventiviFilter, excludedClients]);

  // Calcolo coefficiente di correlazione di Pearson per i clienti filtrati
  const correlationResult = React.useMemo(() => {
    const dataPoints = filteredClientCorrelationData.map(c => ({
      x: c.count,
      y: correlationMetric === 'costoMedio' ? c.costoMedio : c.totale
    }));
    if (dataPoints.length < 2) {
      return { r: 0, text: 'Dati non sufficienti (seleziona almeno 2 clienti per calcolare la correlazione).' };
    }
    
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, d) => sum + d.x, 0);
    const sumY = dataPoints.reduce((sum, d) => sum + d.y, 0);
    const sumXY = dataPoints.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = dataPoints.reduce((sum, d) => sum + d.x * d.x, 0);
    const sumY2 = dataPoints.reduce((sum, d) => sum + d.y * d.y, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) {
      return { r: 0, text: 'Varianza pari a zero. Impossibile stabilire una correlazione lineare.' };
    }

    const r = num / den;
    let text = '';
    const labelMetric = correlationMetric === 'costoMedio' ? 'costo medio' : 'totale ordinato';
    
    if (r > 0.6) {
      text = `Forte correlazione positiva (${r.toFixed(2)}): i clienti con più preventivi tendono ad avere un ${labelMetric} significativamente superiore.`;
    } else if (r > 0.2) {
      text = `Modesta correlazione positiva (${r.toFixed(2)}): tendenza debole ad avere un ${labelMetric} maggiore all'aumentare del numero dei preventivi.`;
    } else if (r < -0.6) {
      text = `Forte correlazione negativa (${r.toFixed(2)}): Effetto "Sconto Quantità"! I clienti con più preventivi tendono ad avere un ${labelMetric} inferiore.`;
    } else if (r < -0.2) {
      text = `Modesta correlazione negativa (${r.toFixed(2)}): tendenza debole ad un ${labelMetric} inferiore all'aumentare dei preventivi richiesti.`;
    } else {
      text = `Nessuna correlazione lineare significativa (${r.toFixed(2)}): il numero di preventivi richiesti non incide in modo lineare sul ${labelMetric}.`;
    }

    return { r: parseFloat(r.toFixed(2)), text };
  }, [filteredClientCorrelationData, correlationMetric]);

  if (isCreating) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setIsCreating(false); setEditingQuotation(null); if (onClearInitialEditing) onClearInitialEditing(); }} className="text-gray-600 hover:text-gray-900">&larr; Torna alla lista</button>
        <QuotationForm editingQuotation={editingQuotation || undefined} onSave={() => {
            setIsCreating(false);
            setEditingQuotation(null);
            if (onClearInitialEditing) onClearInitialEditing();
            getQuotations().then(setQuotations);
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-6 rounded-xl border border-gray-300 shadow-sm text-gray-900">
      
      {/* Pannello Dashboard Statistiche e Analisi */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-300 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-300 pb-4 gap-4">
          <div>
            <h4 className="text-lg font-bold text-gray-950 flex items-center gap-2">
              <BarChart2 size={20} className="text-blue-800" /> Analisi Economica & Correlazione
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Statistiche dettagliate sull'andamento economico dei preventivi e l'indice di correlazione dei clienti.
            </p>
          </div>
          <div className="flex bg-gray-200 p-1 rounded-lg border border-gray-300 shadow-inner self-stretch sm:self-auto">
            <button
              onClick={() => setChartTab('annual')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                chartTab === 'annual'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-150'
              }`}
            >
              <TrendingUp size={14} /> Andamento Annuale
            </button>
            <button
              onClick={() => setChartTab('correlation')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                chartTab === 'correlation'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-950 hover:bg-gray-150'
              }`}
            >
              <Sliders size={14} /> Analisi Correlazione
            </button>
          </div>
        </div>

        {chartTab === 'annual' ? (
          <div className="space-y-6">
            {/* Opzioni di Abilitazione/Disabilitazione Campi */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <Sliders size={14} className="text-blue-700" /> Abilita / Disabilita Campi nel Grafico
              </span>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-blue-400 p-2 rounded-lg cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={showTotale}
                    onChange={(e) => setShowTotale(e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Totale Economico (€)</span>
                </label>
                <label className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-emerald-400 p-2 rounded-lg cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={showPreventivi}
                    onChange={(e) => setShowPreventivi(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Numero Preventivi (unità)</span>
                </label>
                <label className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 hover:border-violet-400 p-2 rounded-lg cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={showCostoMedio}
                    onChange={(e) => setShowCostoMedio(e.target.checked)}
                    className="w-4 h-4 text-violet-600 focus:ring-violet-500 rounded cursor-pointer"
                  />
                  <span className="font-bold text-gray-800">Costo Medio Preventivo (€)</span>
                </label>
              </div>
            </div>

            {/* Grafico Andamento Annuale */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h5 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">
                Andamento Annuale Combinato
              </h5>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" stroke="#4b5563" className="text-[10px] md:text-xs font-semibold" />
                    <YAxis yAxisId="left" stroke="#1d4ed8" label={{ value: 'Valori in €', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '10px', fill: '#1d4ed8', fontWeight: 'bold' } }} className="text-[10px]" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" label={{ value: 'Numero Preventivi', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: '10px', fill: '#10b981', fontWeight: 'bold' } }} className="text-[10px]" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', color: '#111827' }}
                      formatter={(value: any, name: string) => {
                        if (name.includes('€')) return [`€ ${parseFloat(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    
                    {showTotale && (
                      <Bar yAxisId="left" dataKey="totale" fill="#1d4ed8" name="Totale Economico (€)" radius={[4, 4, 0, 0]} barSize={40} />
                    )}
                    {showPreventivi && (
                      <Line yAxisId="right" type="monotone" dataKey="preventivi" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} name="Numero Preventivi" />
                    )}
                    {showCostoMedio && (
                      <Line yAxisId="left" type="monotone" dataKey="media" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" name="Costo Medio Preventivo (€)" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Analisi della Correlazione */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Pannello Controlli Correlazione (Left - Column span 4) */}
              <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-4 text-xs">
                <h5 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <Sliders size={14} className="text-blue-800" /> Controlli Correlazione
                </h5>

                {/* Scelta Metrica Y */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">Metrica Asse Y:</label>
                  <select
                    value={correlationMetric}
                    onChange={(e) => setCorrelationMetric(e.target.value as 'costoMedio' | 'totale')}
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 focus:bg-white text-xs font-medium cursor-pointer"
                  >
                    <option value="costoMedio">Costo Medio Preventivo (€)</option>
                    <option value="totale">Totale Economico Ordinato (€)</option>
                  </select>
                </div>

                {/* Filtro Minimo Preventivi */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">Filtra per Num. Minimo Preventivi: ({minPreventiviFilter})</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={minPreventiviFilter}
                    onChange={(e) => setMinPreventiviFilter(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-700"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 px-1">
                    <span>min: 1</span>
                    <span>max: 10</span>
                  </div>
                </div>

                {/* Abilita / Disabilita Singoli Clienti */}
                <div className="space-y-2">
                  <label className="block font-semibold text-gray-700">Abilita / Disabilita Clienti:</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50 space-y-1.5 shadow-inner">
                    {allClientCorrelationData.map(client => {
                      const isExcluded = excludedClients.includes(client.id);
                      return (
                        <label key={client.id} className="flex items-center gap-2 hover:bg-gray-150 p-1 rounded transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => {
                              if (isExcluded) {
                                setExcludedClients(prev => prev.filter(id => id !== client.id));
                              } else {
                                setExcludedClients(prev => [...prev, client.id]);
                              }
                            }}
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 rounded cursor-pointer"
                          />
                          <span className="truncate text-gray-700 font-medium" title={client.name}>
                            {client.name} <span className="text-gray-400 font-mono">({client.count})</span>
                          </span>
                        </label>
                      );
                    })}
                    {allClientCorrelationData.length === 0 && (
                      <span className="text-gray-400 text-[11px] block text-center py-2">Nessun cliente disponibile</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Disabilita i clienti con valori anomali per ricalcolare l'indice di correlazione puro.
                  </span>
                </div>
              </div>

              {/* Grafico di Correlazione Scatter (Right - Column span 8) */}
              <div className="lg:col-span-8 bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <h5 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    Grafico a Dispersione (Scatter Plot)
                  </h5>
                  <p className="text-xs text-gray-500 mb-4">
                    Asse X: Numero di preventivi richiesti. Asse Y: {correlationMetric === 'costoMedio' ? 'Costo medio preventivo' : 'Totale economico ordinato'}. Ciascun pallino rappresenta un cliente.
                  </p>
                </div>

                <div className="h-64 w-full">
                  {filteredClientCorrelationData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis 
                          type="number" 
                          dataKey="count" 
                          name="Numero Preventivi" 
                          stroke="#4b5563"
                          className="text-[10px]"
                          label={{ value: 'Numero Preventivi richiesti', position: 'insideBottom', offset: -10, style: { fontSize: '10px', fill: '#4b5563', fontWeight: 'bold' } }}
                        />
                        <YAxis 
                          type="number" 
                          dataKey={correlationMetric} 
                          name={correlationMetric === 'costoMedio' ? 'Costo Medio' : 'Totale Speso'} 
                          stroke="#4b5563"
                          className="text-[10px]"
                          label={{ value: correlationMetric === 'costoMedio' ? 'Costo Medio (€)' : 'Totale Ordinato (€)', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: '10px', fill: '#4b5563', fontWeight: 'bold', textAnchor: 'middle' } }}
                        />
                        <ZAxis type="number" dataKey="totale" range={[60, 400]} name="Volume Totale Speso" />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 rounded-lg border border-gray-300 shadow-md text-xs space-y-1">
                                  <p className="font-bold text-gray-900 border-b pb-1 mb-1">{data.name}</p>
                                  <p className="text-gray-600"><span className="font-semibold text-gray-800">Preventivi Richiesti:</span> {data.count}</p>
                                  <p className="text-gray-600"><span className="font-semibold text-gray-800">Costo Medio:</span> € {data.costoMedio.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  <p className="text-blue-700 font-semibold"><span className="font-semibold text-gray-800">Volume Totale:</span> € {data.totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="Clienti" data={filteredClientCorrelationData} fill="#1d4ed8" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50 border border-dashed rounded-lg">
                      Nessun dato da visualizzare. Cambia i filtri a sinistra.
                    </div>
                  )}
                </div>

                {/* Indice di Correlazione Matematico */}
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2.5 items-start">
                  <Info size={16} className="text-blue-800 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    <span className="font-bold block mb-0.5">Indice di Correlazione R di Pearson: {correlationResult.r}</span>
                    <span className="leading-relaxed">{correlationResult.text}</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}
      </div>

      {syncStatusMsg && (
        <div className={`p-4 rounded-xl border flex items-start gap-2.5 text-sm transition-all ${
          syncStatusMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : syncStatusMsg.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <Info size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{syncStatusMsg.text}</div>
          <button 
            onClick={() => setSyncStatusMsg(null)}
            className="text-gray-400 hover:text-gray-600 font-bold ml-2 text-xs cursor-pointer p-1"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold text-gray-900">I Tuoi Preventivi ({filteredQuotations.length})</h3>
        <div className="flex gap-2">
            <button
              onClick={handleSyncAttachments}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer ${
                isSyncing 
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:text-gray-900 border border-gray-300 hover:bg-gray-50'
              }`}
              title="Sincronizza allegati dalle anagrafiche clienti"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sincronizzazione..." : "Sincronizza Allegati"}
            </button>
            <button onClick={() => { setEditingQuotation(null); setIsCreating(true); }} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer">
            <Plus size={18} /> Aggiungi
            </button>
        </div>
      </div>

      {/* Tab Navigation per Anno */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => { setSelectedYear('Tutti'); setCurrentPage(1); }}
          className={`px-4 py-2 font-bold text-sm transition-all border-b-2 -mb-[5px] whitespace-nowrap ${
            selectedYear === 'Tutti'
              ? 'border-blue-700 text-blue-950 bg-blue-50/65 rounded-t-lg'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-t-lg'
          }`}
        >
          Tutti i Preventivi ({quotations.length})
        </button>
        {availableYears.map(yr => (
          <button
            key={yr}
            onClick={() => { setSelectedYear(yr); setCurrentPage(1); }}
            className={`px-4 py-2 font-bold text-sm transition-all border-b-2 -mb-[5px] whitespace-nowrap ${
              selectedYear === yr
                ? 'border-blue-700 text-blue-950 bg-blue-50/65 rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-t-lg'
            }`}
          >
            {yr} ({quotations.filter(q => q.year === yr).length})
          </button>
        ))}
      </div>

      {/* Filtri di Ricerca Avanzati */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-300 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
          <Filter size={14} className="text-blue-700" /> Filtri di Ricerca Preventivi
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro 1: Numero Preventivo */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Numero Preventivo</label>
            <input 
              type="text" 
              placeholder="Es. 12, 12/A..." 
              value={filterNumber}
              onChange={(e) => {
                  setFilterNumber(e.target.value);
                  setCurrentPage(1);
              }}
              className="w-full p-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-xs rounded-lg transition-all"
            />
          </div>

          {/* Filtro 2: Intestazione / Cliente */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Intestazione / Cliente</label>
            <input 
              type="text" 
              placeholder="Es. Mario Rossi, Azienda..." 
              value={filterIntestazione}
              onChange={(e) => {
                  setFilterIntestazione(e.target.value);
                  setCurrentPage(1);
              }}
              className="w-full p-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-xs rounded-lg transition-all"
            />
          </div>

          {/* Filtro 3: Data Preventivo */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Data Preventivo</label>
            <div className="relative">
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCurrentPage(1);
                }}
                className="w-full p-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs rounded-lg transition-all"
              />
              {filterDate && (
                <button
                  onClick={() => {
                    setFilterDate('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer p-1"
                  title="Pulisci data"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottone di reset filtri se attivi */}
        {(filterNumber || filterIntestazione || filterDate || searchQuery) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setFilterNumber('');
                setFilterIntestazione('');
                setFilterDate('');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              Pulisci tutti i filtri
            </button>
          </div>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-300">
        <table className="w-full text-left">
          <thead className="bg-gray-100 border-b border-gray-300 text-gray-750 font-bold text-xs uppercase tracking-wider select-none">
            <tr>
              <th 
                className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => handleSort('number')}
                title="Ordina per numero preventivo"
              >
                <div className="flex items-center gap-1">
                  <span>Preventivo</span>
                  {sortField === 'number' ? (
                    sortDirection === 'asc' ? <ChevronUp size={14} className="text-blue-700" /> : <ChevronDown size={14} className="text-blue-700" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => handleSort('date')}
                title="Ordina per data"
              >
                <div className="flex items-center gap-1">
                  <span>Data</span>
                  {sortField === 'date' ? (
                    sortDirection === 'asc' ? <ChevronUp size={14} className="text-blue-700" /> : <ChevronDown size={14} className="text-blue-700" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() => handleSort('client')}
                title="Ordina per intestazione/cliente"
              >
                <div className="flex items-center gap-1">
                  <span>Intestazione</span>
                  {sortField === 'client' ? (
                    sortDirection === 'asc' ? <ChevronUp size={14} className="text-blue-700" /> : <ChevronDown size={14} className="text-blue-700" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-300 opacity-0 hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3">Totale Preventivo</th>
              <th className="px-6 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="w-full">
            {paginatedQuotations.map((q, index) => (
              <tr key={`${q.id}-${index}`} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50/80 transition-colors w-full">
                <td className="px-6 py-4 cursor-pointer text-blue-800 hover:text-blue-950 font-bold hover:underline" onClick={() => { setEditingQuotation(q); setIsCreating(true); }}>
                  {q.number}/{q.year % 100}
                  {q.attachment && <Paperclip size={14} className="inline ml-2 text-gray-500" />}
                </td>
                <td className="px-6 py-4">{formatDate(q.date)}</td>
                <td className="px-6 py-4">{q.clientInfo?.intestazione || q.clientInfo?.name}</td>
                <td className="px-6 py-4 font-mono">€{q.totalAmount.toFixed(2)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => handleDuplicate(q, e)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors cursor-pointer"
                      title="Duplica preventivo"
                    >
                      <Copy size={13} />
                      <span>Duplica</span>
                    </button>
                    <button 
                      onClick={(e) => handleDelete(q.id, e)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg transition-colors cursor-pointer"
                      title="Elimina preventivo"
                    >
                      <Trash2 size={13} />
                      <span>Elimina</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginatedQuotations.length === 0 && (
              <tr className="flex w-full">
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 w-full">Nessun preventivo trovato</td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 p-4 border-t border-gray-200 bg-gray-50">
                <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-gray-700 transition-colors"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="text-xs text-gray-700 font-semibold">Pagina {currentPage} di {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-gray-700 transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-200 p-6 rounded-lg shadow-xl max-w-sm w-full border border-gray-300">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sei sicuro di voler eliminare questo preventivo?</h3>
            <p className="text-sm text-gray-700 mb-6">Questa operazione non può essere annullata.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelDelete} className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-300 rounded-md hover:bg-gray-400">
                Annulla
              </button>
              <button onClick={handleConfirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-md hover:bg-red-800">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
