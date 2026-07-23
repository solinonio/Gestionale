import React, { useState, useEffect } from 'react';
import { getLaserProcessingData, saveLaserProcessingData, getClients, getSharedMaterials, addSharedMaterial } from '../lib/db';
import { LaserProcessingData, LaserConfigRow, LaserColorRow, Client, User, SharedMaterial } from '../types';
import { Plus, Trash2, Copy, Save, Check, Cpu, Zap, Settings, RefreshCw, Search, Star, User as UserIcon, Wind, Fan, Edit, CircleDashed, Activity } from 'lucide-react';

const LightburnIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5 C25.1 5 5 25.1 5 50 C5 74.9 25.1 95 50 95 C72.1 95 90.6 79.1 94.3 58 C94.7 55.8 93 54 90.8 54 C88.9 54 87.4 55.3 87.1 57.1 C83.9 74.3 68.4 87.5 50 87.5 C29.3 87.5 12.5 70.7 12.5 50 C12.5 29.3 29.3 12.5 50 12.5 C68.3 12.5 83.6 25.6 87 42.5 L78 35.5 C76.5 34.3 74.2 34.7 73.1 36.3 C72 37.9 72.3 40.2 73.9 41.3 L92.9 56.1 C93.8 56.8 95.1 56.9 96.1 56.3 C97.1 55.7 97.6 54.6 97.5 53.5 L95 23.5 C94.8 21.3 92.8 19.8 90.6 20.1 C88.4 20.4 86.9 22.4 87.2 24.6 L88.2 36.5 C83.2 22 68.6 11.5 50 11.5" fill="currentColor" />
    <path d="M42 37 C42 37 46 32 50 34 C54 36 57 39 59 36 C61 33 65 37 68 41 C71 45 74 44 77 48 C80 52 82 56 81 61 C80 66 74 72 70 75 C66 78 61 77 56 75 C51 73 45 78 39 74 C33 70 32 63 36 62 C40 61 41 64 45 64 C49 64 53 62 55 58 C57 54 53 52 48 53 C43 54 39 52 35 48 C31 44 33 42 36 43 C39 44 42 45 44 42 C46 39 42 37 42 37 Z" fill="currentColor" />
    <circle cx="56" cy="46" r="3" fill="#ffffff" />
  </svg>
);

const ScaLaserIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size * 0.5} viewBox="0 0 120 60" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f3f4f6" />
        <stop offset="50%" stopColor="#9ca3af" />
        <stop offset="100%" stopColor="#4b5563" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="30" rx="55" ry="25" fill="url(#silverGrad)" stroke="#374151" strokeWidth="2" />
    <ellipse cx="60" cy="30" rx="51" ry="21" fill="none" stroke="#e5e7eb" strokeWidth="1" />
    <text x="60" y="26" fontFamily="Impact, Arial Black, sans-serif" fontSize="20" fontWeight="bold" fill="#000" textAnchor="middle" letterSpacing="1">SCA</text>
    <text x="60" y="44" fontFamily="Brush Script MT, cursive, Arial, sans-serif" fontSize="16" fontWeight="bold" fill="#e11d48" fontStyle="italic" textAnchor="middle">Laser</text>
    <line x1="82" y1="41" x2="105" y2="41" stroke="#e11d48" strokeWidth="2" />
    <circle cx="105" cy="41" r="2" fill="#fff" />
    <path d="M105 35 L105 47 M99 41 L111 41 M101 37 L109 45 M101 45 L109 37" stroke="#e11d48" strokeWidth="1" />
  </svg>
);

const EzcIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="90" rx="15" fill="#1e293b" stroke="#f59e0b" strokeWidth="4" />
    <text x="50" y="65" fontFamily="Impact, Arial Black, sans-serif" fontSize="42" fontWeight="black" fill="#f59e0b" textAnchor="middle" letterSpacing="1">EZC</text>
    <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
    <line x1="15" y1="15" x2="85" y2="85" stroke="#ef4444" strokeWidth="2" opacity="0.8" />
  </svg>
);

interface Props {
  currentUser?: User | null;
  key?: string;
}

export default function LaserProcessing({ currentUser }: Props) {
  const [laserData, setLaserData] = useState<LaserProcessingData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'Tutti' | 'X252' | 'Fibra' | 'Prometheo' | 'PHECDA'>('Tutti');
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [softwareFilter, setSoftwareFilter] = useState<'all' | 'lightburn' | 'scalasering' | 'ezc'>('all');
  const [editingRow, setEditingRow] = useState<LaserConfigRow | null>(null);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [sharedMaterials, setSharedMaterials] = useState<SharedMaterial[]>([]);

  const loadSharedMaterialsData = async () => {
    try {
      const mats = await getSharedMaterials();
      const sorted = [...mats].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
      setSharedMaterials(sorted);
    } catch (err) {
      console.error('Failed to load shared materials', err);
    }
  };

  const [openCounts, setOpenCounts] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('laser_material_open_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const incrementOpenCount = (materialeName: string) => {
    if (!materialeName || materialeName === 'Nuovo Materiale') return;
    setOpenCounts(prev => {
      const updated = {
        ...prev,
        [materialeName]: (prev[materialeName] || 0) + 1
      };
      localStorage.setItem('laser_material_open_counts', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSaveModalRow = () => {
    if (!laserData || !editingRow) return;

    let updatedData = { ...laserData };

    const foundTab = (['X252', 'Fibra', 'Prometheo'] as const).find(tab => 
      (laserData[tab] || []).some(r => r.id === editingRow.id)
    );

    const targetTab = editingRow.origin || foundTab || (activeSubTab === 'Tutti' ? 'X252' : activeSubTab as 'X252' | 'Fibra' | 'Prometheo');

    // Clean up origin before saving to persist clean structures
    const savedRow = { ...editingRow, lastModifiedBy: currentUser?.username || 'Admin' };
    delete savedRow.origin;

    if (foundTab && foundTab !== targetTab) {
      // If the laser machine association changed, move from the source tab to the destination tab
      updatedData[foundTab] = (laserData[foundTab] || []).filter(row => row.id !== editingRow.id);
      updatedData[targetTab] = [...(laserData[targetTab] || []), savedRow];
    } else {
      // Just save within the same targetTab
      const exists = (laserData[targetTab] || []).some(row => row.id === editingRow.id);
      if (exists) {
        updatedData[targetTab] = (laserData[targetTab] || []).map(row => {
          if (row.id === editingRow.id) {
            return savedRow;
          }
          return row;
        });
      } else {
        updatedData[targetTab] = [...(laserData[targetTab] || []), savedRow];
      }
    }

    setLaserData(updatedData);
    setIsModalOpen(false);
    setEditingRow(null);
    setEditingRowIndex(null);

    handleSaveAll(updatedData);
  };

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [data, allClients] = await Promise.all([
          getLaserProcessingData(),
          getClients()
        ]);
        
        // Clean speed unit from legacy data
        if (data) {
          (['X252', 'Fibra', 'Prometheo'] as const).forEach(key => {
            if (data[key]) {
              data[key] = data[key].map(row => ({
                ...row,
                velocita: row.velocita ? row.velocita.replace(/\s*mm\/s/g, '') : ''
              }));
            }
          });
          if (data.savedMaterials) {
            data.savedMaterials = data.savedMaterials.map(preset => ({
              ...preset,
              velocita: preset.velocita ? preset.velocita.replace(/\s*mm\/s/g, '') : ''
            }));
          }
        }

        setLaserData(data);
        setClients(allClients);
      } catch (e) {
        console.error('Errore durante il caricamento dei dati:', e);
      }
    }
    loadData();
    loadSharedMaterialsData();

    const handleSync = () => {
      loadSharedMaterialsData();
    };
    window.addEventListener('database-synced', handleSync);
    return () => {
      window.removeEventListener('database-synced', handleSync);
    };
  }, []);

  // Save full data
  const handleSaveAll = async (currentData: LaserProcessingData) => {
    setSavingStatus('saving');
    try {
      await saveLaserProcessingData(currentData);
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSavingStatus('error');
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  if (!laserData) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const currentRows = (() => {
    if (activeSubTab === 'Tutti') {
      return [
        ...(laserData.X252 || []).map(r => ({ ...r, origin: 'X252' as const })),
        ...(laserData.Fibra || []).map(r => ({ ...r, origin: 'Fibra' as const })),
        ...(laserData.Prometheo || []).map(r => ({ ...r, origin: 'Prometheo' as const })),
        ...(laserData['PHECDA'] || []).map(r => ({ ...r, origin: 'PHECDA' as const }))
      ];
    }
    const tab = activeSubTab as 'X252' | 'Fibra' | 'Prometheo' | 'PHECDA';
    return (laserData[tab] || []).map(r => ({ ...r, origin: tab }));
  })();

  // Determine top 3 intelligent materials based on openCounts and favorites (presets)
  const topMaterials: string[] = (() => {
    // Get all unique material names in the current active tab rows
    const uniqueMaterials = Array.from(new Set(currentRows.map(r => r.materiale.trim()))) as string[];
    const cleanUnique = uniqueMaterials.filter(m => m && m !== 'Nuovo Materiale');

    // Score them
    const scored = cleanUnique.map(matName => {
      let score = 0;
      
      // 1. Is it a favorite/preset? If yes, add high weight
      const isPreset = laserData.savedMaterials?.some((p: any) => p.materiale.toLowerCase() === matName.toLowerCase());
      if (isPreset) score += 15;

      // 2. Add clicks count as weight
      const clicks = openCounts[matName] || 0;
      score += clicks;

      return { name: matName, score };
    });

    // Sort by score descending and take top 3
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.name);
  })();

  // Filter rows by material, client, and software filter
  const filteredRows = currentRows.filter(row => {
    const matchMaterial = row.materiale.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Find paired client name if any
    const pairedClient = clients.find(c => c.id === row.clientId);
    const clientName = pairedClient ? (pairedClient.intestazione || pairedClient.name || '') : '';
    const matchClient = clientName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchSearch = matchMaterial || matchClient;

    // Software filter
    let matchSoftware = true;
    if (softwareFilter === 'lightburn') {
      matchSoftware = !!row.softwareLightburn;
    } else if (softwareFilter === 'scalasering') {
      matchSoftware = !!row.softwareScaLaser;
    } else if (softwareFilter === 'ezc') {
      matchSoftware = !!row.softwareEzc;
    }

    return matchSearch && matchSoftware;
  });

  const sortedRows = [...filteredRows].sort((a, b) => a.materiale.localeCompare(b.materiale));
  const totalPages = Math.ceil(sortedRows.length / ITEMS_PER_PAGE);
  const paginatedRows = sortedRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Handle value change for a cell
  const handleCellChange = (rowIndex: number, field: keyof Omit<LaserConfigRow, 'id'>, value: string) => {
    // Need to adjust index for pagination
    const actualRowIndex = filteredRows.indexOf(sortedRows[(currentPage - 1) * ITEMS_PER_PAGE + rowIndex]);
    if (actualRowIndex === -1) return;
    
    if (!laserData) return;

    let updatedData = { ...laserData };

    if (activeSubTab === 'Tutti') {
      const rowToUpdate = filteredRows[actualRowIndex];
      if (!rowToUpdate) return;
      const origin = (rowToUpdate as any).origin || 'X252';
      updatedData[origin as 'X252' | 'Fibra' | 'Prometheo'] = (updatedData[origin as 'X252' | 'Fibra' | 'Prometheo'] || []).map((row) => {
        if (row.id === rowToUpdate.id) {
          return { ...row, [field]: value, lastModifiedBy: currentUser?.username || 'Admin' };
        }
        return row;
      });
    } else {
      const tab = activeSubTab as 'X252' | 'Fibra' | 'Prometheo';
      updatedData[tab] = (updatedData[tab] || []).map((row, idx) => {
        if (idx === actualRowIndex) {
          return { ...row, [field]: value, lastModifiedBy: currentUser?.username || 'Admin' };
        }
        return row;
      });
    }

    setLaserData(updatedData);
    // Auto-save silently on cell update
    saveLaserProcessingData(updatedData);
  };

  // Duplicate a row
  const handleDuplicateRow = (rowIndex: number) => {
    if (!laserData) return;

    const rowToDuplicate = currentRows[rowIndex];
    if (!rowToDuplicate) return;

    const newRow: LaserConfigRow = {
      ...rowToDuplicate,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      materiale: `${rowToDuplicate.materiale} (Copia)`
    };

    let updatedData = { ...laserData };

    if (activeSubTab === 'Tutti') {
      const origin = (rowToDuplicate as any).origin || 'X252';
      const targetTab = origin as 'X252' | 'Fibra' | 'Prometheo';
      const tabRows = [...(laserData[targetTab] || [])];
      const indexInTab = tabRows.findIndex(r => r.id === rowToDuplicate.id);
      if (indexInTab !== -1) {
        tabRows.splice(indexInTab + 1, 0, newRow);
      } else {
        tabRows.push(newRow);
      }
      updatedData[targetTab] = tabRows;
    } else {
      const tab = activeSubTab as 'X252' | 'Fibra' | 'Prometheo';
      const updatedRows = [...(laserData[tab] || [])];
      updatedRows.splice(rowIndex + 1, 0, newRow);
      updatedData[tab] = updatedRows;
    }

    setLaserData(updatedData);
    handleSaveAll(updatedData);
  };

  // Delete a row
  const handleDeleteRow = (rowIndex: number) => {
    if (!laserData) return;

    const rowToDelete = currentRows[rowIndex];
    if (!rowToDelete) return;

    let updatedData = { ...laserData };

    if (activeSubTab === 'Tutti') {
      const origin = (rowToDelete as any).origin || 'X252';
      const targetTab = origin as 'X252' | 'Fibra' | 'Prometheo';
      updatedData[targetTab] = (laserData[targetTab] || []).filter(r => r.id !== rowToDelete.id);
    } else {
      const tab = activeSubTab as 'X252' | 'Fibra' | 'Prometheo';
      updatedData[tab] = (laserData[tab] || []).filter((_, idx) => idx !== rowIndex);
    }

    setLaserData(updatedData);
    handleSaveAll(updatedData);
  };

  // Add a new row
  const handleAddRow = () => {
    if (!laserData) return;

    const targetTab = activeSubTab === 'Tutti' ? 'X252' : activeSubTab as 'X252' | 'Fibra' | 'Prometheo';

    const newRow: LaserConfigRow = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
      materiale: 'Nuovo Materiale',
      potenza: '50%',
      velocita: '20',
      passaggi: '1',
      frequenza: '20000 Hz',
      note: '',
      aria: false,
      aspirazione: false,
      softwareLightburn: targetTab === 'Prometheo',
      softwareScaLaser: targetTab === 'X252',
      softwareEzc: targetTab === 'Fibra'
    };

    let updatedData = { ...laserData };
    const updatedRows = [...(laserData[targetTab] || []), newRow];
    updatedData[targetTab] = updatedRows;

    setLaserData(updatedData);
    handleSaveAll(updatedData);

    // Automatically open the detailed card modal for the new row
    setEditingRow(newRow);
    setEditingRowIndex(updatedRows.length - 1);
    setIsModalOpen(true);
  };

  // Save a specific row's material configuration as a preset
  const handleSaveAsPreset = (row: LaserConfigRow) => {
    if (!laserData) return;
    const presetName = row.materiale.trim();
    if (!presetName || presetName === 'Nuovo Materiale') {
      alert('Inserisci un nome valido per il materiale prima di salvarlo como preset.');
      return;
    }

    const savedMaterials = laserData.savedMaterials || [];
    const existingIndex = savedMaterials.findIndex(m => m.materiale.toLowerCase() === presetName.toLowerCase());

    const newPreset: Omit<LaserConfigRow, 'id' | 'clientId'> = {
      materiale: row.materiale,
      potenza: row.potenza,
      velocita: row.velocita,
      passaggi: row.passaggi,
      frequenza: row.frequenza,
      note: row.note,
      aria: !!row.aria,
      aspirazione: !!row.aspirazione,
      softwareLightburn: !!row.softwareLightburn,
      softwareScaLaser: !!row.softwareScaLaser,
      softwareEzc: !!row.softwareEzc
    };

    let updatedPresets = [...savedMaterials];
    if (existingIndex !== -1) {
      updatedPresets[existingIndex] = newPreset;
    } else {
      updatedPresets.push(newPreset);
    }

    const updatedData: LaserProcessingData = {
      ...laserData,
      savedMaterials: updatedPresets
    };

    setLaserData(updatedData);
    handleSaveAll(updatedData);
  };

  // Delete a saved preset
  const handleDeletePreset = (presetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!laserData) return;

    const savedMaterials = laserData.savedMaterials || [];
    const updatedPresets = savedMaterials.filter(m => m.materiale !== presetName);

    const updatedData: LaserProcessingData = {
      ...laserData,
      savedMaterials: updatedPresets
    };

    setLaserData(updatedData);
    handleSaveAll(updatedData);
  };

  const handleAddColorRowToEditing = () => {
    if (!editingRow) return;
    const newRow = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      raster: false,
      vector: true,
      colorRgb: '#FF0000'
    };
    setEditingRow({
      ...editingRow,
      colorRows: [...(editingRow.colorRows || []), newRow]
    });
  };

  const handleUpdateColorRowInEditing = (id: string, field: 'raster' | 'vector' | 'colorRgb' | 'velocita' | 'potenza' | 'frequenza' | 'passaggi' | 'modalita' | 'dpi' | 'ppi', value: any) => {
    if (!editingRow) return;
    const updated = (editingRow.colorRows || []).map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setEditingRow({
      ...editingRow,
      colorRows: updated
    });
  };

  const handleDeleteColorRowFromEditing = (id: string) => {
    if (!editingRow) return;
    const updated = (editingRow.colorRows || []).filter(row => row.id !== id);
    setEditingRow({
      ...editingRow,
      colorRows: updated
    });
  };

  // Load a preset into a specific row
  const handleApplyPreset = (rowIndex: number, preset: Omit<LaserConfigRow, 'id' | 'clientId'>) => {
    if (!laserData) return;

    const rowToApply = currentRows[rowIndex];
    if (!rowToApply) return;

    let updatedData = { ...laserData };

    const applyToRow = (row: LaserConfigRow) => ({
      ...row,
      materiale: preset.materiale,
      potenza: preset.potenza,
      velocita: preset.velocita,
      passaggi: preset.passaggi,
      frequenza: preset.frequenza,
      note: preset.note,
      aria: !!preset.aria,
      aspirazione: !!preset.aspirazione,
      softwareLightburn: !!preset.softwareLightburn,
      softwareScaLaser: !!preset.softwareScaLaser,
      softwareEzc: !!preset.softwareEzc,
      lastModifiedBy: currentUser?.username || 'Admin'
    });

    if (activeSubTab === 'Tutti') {
      const origin = (rowToApply as any).origin || 'X252';
      const targetTab = origin as 'X252' | 'Fibra' | 'Prometheo';
      updatedData[targetTab] = (laserData[targetTab] || []).map(row => {
        if (row.id === rowToApply.id) {
          return applyToRow(row);
        }
        return row;
      });
    } else {
      const tab = activeSubTab as 'X252' | 'Fibra' | 'Prometheo';
      updatedData[tab] = (laserData[tab] || []).map((row, idx) => {
        if (idx === rowIndex) {
          return applyToRow(row);
        }
        return row;
      });
    }

    setLaserData(updatedData);
    handleSaveAll(updatedData);
  };

  return (
    <div className="space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="text-amber-400 fill-amber-400" size={24} /> Lavorazione Materiali con Laser
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Gestisci i parametri di lavorazione dei materiali per ciascun modello di incisore laser. Abbina le lavorazioni ai clienti e salva i tuoi materiali preferiti.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {savingStatus === 'saved' && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-fade-in">
              <Check size={14} /> Salvato!
            </span>
          )}
          {savingStatus === 'saving' && (
            <span className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
              <RefreshCw className="animate-spin" size={14} /> Salvataggio...
            </span>
          )}
          {savingStatus === 'error' && (
            <span className="text-xs text-rose-400 font-bold">
              Errore di salvataggio!
            </span>
          )}
          <button
            onClick={() => handleSaveAll(laserData)}
            className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 text-sm font-medium transition-all shadow-md"
            title="Salva modifiche"
            id="btn-save-laser"
          >
            <Save size={16} /> Salva Configurazione
          </button>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-gray-200 p-10 rounded-xl border border-gray-300 shadow-sm text-gray-900 max-w-[84rem] mx-auto w-full">
        
        {/* Gestione Preset Materiali */}
        {laserData.savedMaterials && laserData.savedMaterials.length > 0 && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-300 text-xs shadow-inner">
            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">
              <Star className="text-amber-500 fill-amber-500" size={14} /> Preset Materiali Salvati ({laserData.savedMaterials.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {laserData.savedMaterials.map((preset, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-250 text-gray-800 px-3 py-1 rounded-full border border-gray-300 transition-colors shadow-sm"
                >
                  <span className="font-semibold">{preset.materiale}</span>
                  <span className="text-[10px] text-gray-500 font-mono">({preset.potenza} - {preset.velocita})</span>
                  <button
                    onClick={(e) => handleDeletePreset(preset.materiale, e)}
                    className="text-gray-400 hover:text-red-600 font-bold transition-colors ml-1.5 focus:outline-none"
                    title="Elimina preset"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs and Search */}
        <div className="flex flex-col border-b border-gray-300 pb-3 mb-6 gap-4">
          <div className="flex flex-wrap gap-2">
            {(['Tutti', 'X252', 'Fibra', 'Prometheo', 'PHECDA'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-4 py-2 font-bold text-sm transition-all rounded-lg flex items-center gap-2 ${
                  activeSubTab === tab
                    ? 'bg-blue-800 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {tab === 'X252' && <CircleDashed size={16} />}
                {tab === 'Fibra' && <Activity size={16} />}
                {tab === 'Prometheo' && <CircleDashed size={16} />}
                {tab === 'PHECDA' && <Zap size={16} />}
                {tab === 'Tutti' && <Cpu size={16} />}
                {tab}
              </button>
            ))}
          </div>

          {/* Search bar inside the main card */}
          <div className="relative w-full lg:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              id="laser-search"
              placeholder="Cerca materiale o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Pannello Filtri Avanzato */}
        <div className="bg-white p-4 rounded-xl border border-gray-300 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-row items-center gap-6 flex-nowrap overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {/* Filtro Software */}
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <span>🖥️</span> Filtra per Software
              </span>
              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-250 text-xs">
                <button
                  type="button"
                  onClick={() => setSoftwareFilter('all')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    softwareFilter === 'all'
                      ? 'bg-blue-800 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tutti
                </button>
                <button
                  type="button"
                  onClick={() => setSoftwareFilter('lightburn')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    softwareFilter === 'lightburn'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LightburnIcon size={13} className={softwareFilter === 'lightburn' ? 'text-white' : 'text-red-700'} /> Lightburn
                </button>
                <button
                  type="button"
                  onClick={() => setSoftwareFilter('scalasering')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    softwareFilter === 'scalasering'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ScaLaserIcon size={13} className={softwareFilter === 'scalasering' ? 'text-white' : ''} /> SCA Laser
                </button>
                <button
                  type="button"
                  onClick={() => setSoftwareFilter('ezc')}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    softwareFilter === 'ezc'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <EzcIcon size={12} className={softwareFilter === 'ezc' ? 'text-white' : 'text-amber-500'} /> Fibra (EZC)
                </button>
              </div>
            </div>

            {/* Intelligent Material Filter (Top 3) */}
            <div className="flex flex-col gap-1 shrink-0">
              <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Star size={10} className="text-amber-500 fill-amber-500" /> Scorciatoie Materiale (Più Usati / Preferiti)
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {topMaterials.map((mat, idx) => {
                  const isActive = searchQuery.toLowerCase() === mat.toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setSearchQuery('');
                        } else {
                          setSearchQuery(mat);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-blue-800 border-blue-800 text-white shadow-md'
                          : 'bg-gray-50 hover:bg-gray-150 border-gray-300 text-gray-700 hover:text-gray-950'
                      }`}
                    >
                      <span>📄</span> {mat}
                    </button>
                  );
                })}
                {topMaterials.length === 0 && (
                  <span className="text-xs text-gray-400 italic">Nessun materiale consigliato ancora</span>
                )}
              </div>
            </div>
          </div>

          {/* Reset Filters */}
          {(softwareFilter !== 'all' || searchQuery !== '') && (
            <button
              type="button"
              onClick={() => {
                setSoftwareFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-200 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-end md:self-center shadow-xs"
            >
              <RefreshCw size={12} /> Reset Filtri
            </button>
          )}
        </div>

        {/* Laser Table */}
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-300 shadow-sm">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-300 font-bold">
              <tr>
                <th className="px-4 py-3 min-w-[220px]">Materiale</th>
                <th className="px-4 py-3 w-[100px]">Potenza</th>
                <th className="px-4 py-3 w-[110px]">Velocità</th>
                <th className="px-4 py-3 w-[85px] text-center">Passaggi</th>
                {(activeSubTab === 'Fibra' || activeSubTab === 'Tutti') && <th className="px-4 py-3 w-[110px]">Frequenza</th>}
                <th className="px-4 py-3 w-[90px] text-center">Aria</th>
                <th className="px-4 py-3 w-[110px] text-center">Aspirazione</th>
                <th className="px-4 py-3 w-[130px] text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map((row, index) => {
                const isLastRow = index === filteredRows.length - 1;
                // Find actual index in state rows for mutating state
                const actualIndex = currentRows.findIndex(r => r.id === row.id);
                const rowIndex = actualIndex !== -1 ? actualIndex : index;

                return (
                  <tr 
                    key={row.id} 
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (!target.closest('button, select, input')) {
                        setEditingRow({ ...row });
                        setEditingRowIndex(rowIndex);
                        setIsModalOpen(true);
                        incrementOpenCount(row.materiale);
                      }
                    }}
                  >
                    {/* Materiale */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingRow({ ...row });
                              setEditingRowIndex(rowIndex);
                              setIsModalOpen(true);
                              incrementOpenCount(row.materiale);
                            }}
                            className="text-left font-bold text-blue-800 hover:text-blue-950 hover:underline cursor-pointer transition-all flex items-center gap-2"
                          >
                            <span>{row.materiale || 'Senza Nome'}</span>
                            {row.spessore !== undefined && row.spessore > 0 && (
                              <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                                {row.spessore} mm
                              </span>
                            )}
                          </button>
                          {row.materiale.trim() && row.materiale !== 'Nuovo Materiale' && (
                            <button
                              onClick={() => handleSaveAsPreset(row)}
                              className="p-1 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors focus:outline-none cursor-pointer"
                              title="Salva questo materiale come preset"
                            >
                              <Star size={13} className="hover:fill-amber-500" />
                            </button>
                          )}
                        </div>
                        {/* Machine/Laser Model Badge & Selected Software Badges */}
                        {(activeSubTab === 'Tutti' || row.softwareLightburn || row.softwareScaLaser || row.softwareEzc) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-1">
                            {activeSubTab === 'Tutti' && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                (row as any).origin === 'Fibra'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : (row as any).origin === 'Prometheo'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                <Cpu size={10} /> {(row as any).origin || 'X252'}
                              </span>
                            )}
                            {row.softwareLightburn && (
                              <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[9px] font-bold" title="Usa Lightburn">
                                <LightburnIcon size={11} className="text-red-700" /> Lightburn
                              </span>
                            )}
                            {row.softwareScaLaser && (
                              <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold" title="Usa SCA Laser">
                                <ScaLaserIcon size={12} /> SCA Laser
                              </span>
                            )}
                            {row.softwareEzc && (
                              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-bold" title="Usa EZCAD (Fibra)">
                                <EzcIcon size={11} /> Fibra (EZC)
                              </span>
                            )}
                            {row.lastModifiedBy && (
                              <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-700 border border-gray-300 px-1.5 py-0.5 rounded text-[9px] font-semibold" title={`Ultima modifica di: ${row.lastModifiedBy}`}>
                                <UserIcon size={10} className="text-gray-500" /> {row.lastModifiedBy}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Associated colors list */}
                        {row.colorRows && row.colorRows.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 pb-1">
                            {row.colorRows.map((col, cIdx) => (
                              <div 
                                key={cIdx} 
                                className="w-4.5 h-4.5 rounded-full border border-gray-300 shadow-3xs flex items-center justify-center shrink-0" 
                                style={{ backgroundColor: col.colorRgb }}
                                title={`${col.raster ? 'RASTER' : ''} ${col.vector ? 'VECTOR' : ''} (${col.colorRgb})`}
                              >
                                <span className="text-[8px] text-white font-black drop-shadow-md select-none">
                                  {col.raster && col.vector ? 'RV' : col.raster ? 'R' : col.vector ? 'V' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Preset Selection Dropdown */}
                        {laserData.savedMaterials && laserData.savedMaterials.length > 0 ? (
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 pl-0">
                            <span>Preset:</span>
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  const selected = laserData.savedMaterials?.find(p => p.materiale === val);
                                  if (selected) {
                                    handleApplyPreset(rowIndex, selected);
                                  }
                                }
                              }}
                              className="bg-transparent border-none text-blue-700 hover:text-blue-900 focus:ring-0 cursor-pointer font-bold p-0 pr-4 text-[10px] outline-none"
                            >
                              <option value="">Scegli preset...</option>
                              {laserData.savedMaterials.map((p, pIdx) => (
                                <option key={pIdx} value={p.materiale}>
                                  {p.materiale} ({p.potenza} - {p.velocita})
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="text-[9px] text-gray-400 italic">
                            Clicca sul nome per configurare e salvare
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Potenza */}
                    <td className="px-4 py-3 text-gray-800 font-mono text-sm">
                      {row.potenza || '-'}
                    </td>

                    {/* Velocità */}
                    <td className="px-4 py-3 text-gray-800 font-mono text-sm">
                      {row.velocita || '-'}
                    </td>

                    {/* Passaggi */}
                    <td className="px-4 py-3 text-gray-800 font-mono text-sm text-center">
                      {row.passaggi || '-'}
                    </td>

                    {/* Frequenza - ONLY if Fibra or Tutti */}
                    {(activeSubTab === 'Fibra' || activeSubTab === 'Tutti') && (
                      <td className="px-4 py-3 text-gray-800 font-mono text-sm">
                        {(row.origin === 'Fibra' || row.softwareEzc) ? (row.frequenza || '-') : ''}
                      </td>
                    )}

                    {/* Aria */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        {row.aria ? (
                          <Wind className="text-blue-600 w-5 h-5 animate-pulse" title="Aria Attiva" />
                        ) : (
                          <Wind className="text-gray-400 opacity-25 w-5 h-5" title="Aria Disattivata (Non attiva)" />
                        )}
                      </div>
                    </td>

                    {/* Aspirazione */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        {row.aspirazione ? (
                          <Fan className="text-teal-600 w-5 h-5" title="Aspirazione Attiva" />
                        ) : (
                          <Fan className="text-gray-400 opacity-25 w-5 h-5" title="Aspirazione Disattivata (Non attiva)" />
                        )}
                      </div>
                    </td>

                    {/* Actions Cell */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Duplicate Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateRow(rowIndex);
                          }}
                          className="p-1 rounded text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors focus:outline-none cursor-pointer"
                          title="Duplica questa riga"
                        >
                          <Copy size={15} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(rowIndex);
                          }}
                          className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none cursor-pointer"
                          title="Elimina riga"
                        >
                          <Trash2 size={15} />
                        </button>

                        {/* Add row button at the end of the very last row */}
                        {isLastRow && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddRow();
                            }}
                            className="p-1 ml-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
                            title="Aggiungi una nuova riga"
                          >
                            <Plus size={15} className="font-bold" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={(activeSubTab === 'Fibra' || activeSubTab === 'Tutti') ? 8 : 7} className="px-6 py-10 text-center text-gray-500">
                    <p className="font-medium">Nessuna corrispondenza trovata per la ricerca o nessun materiale configurato.</p>
                    <button
                      onClick={handleAddRow}
                      className="mt-3 inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Aggiungi primo materiale
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-white border border-gray-300 text-xs font-bold disabled:opacity-50"
            >
              Precedente
            </button>
            <span className="text-xs font-bold text-gray-700">Pagina {currentPage} di {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-white border border-gray-300 text-xs font-bold disabled:opacity-50"
            >
              Successiva
            </button>
          </div>
        )}

        {/* Footer/Help Tip inside the card */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-600 gap-2">
          <p>💡 <em>Clicca sul nome di un materiale per aprire la sua scheda dettagliata, configurare aria/aspirazione, abbinare il cliente o aggiungere note.</em></p>
          {currentRows.length > 0 && (
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 text-blue-800 hover:text-blue-900 font-bold hover:underline self-start focus:outline-none cursor-pointer"
            >
              <Plus size={14} /> Aggiungi riga in fondo
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Card Modal / Scheda Dedicata */}
      {isModalOpen && editingRow && (() => {
        const selectedSoftware = editingRow.softwareLightburn 
          ? 'lightburn' 
          : editingRow.softwareScaLaser 
            ? 'scalasering' 
            : editingRow.softwareEzc 
              ? 'ezc' 
              : 'none';

        const handleSoftwareChange = (value: 'lightburn' | 'scalasering' | 'ezc' | 'none') => {
          setEditingRow({
            ...editingRow,
            softwareLightburn: value === 'lightburn',
            softwareScaLaser: value === 'scalasering',
            softwareEzc: value === 'ezc'
          });
        };

        const isFavorite = laserData.savedMaterials?.some((p: any) => p.materiale.toLowerCase() === editingRow.materiale.toLowerCase());

        const originTab = editingRow.origin || (['X252', 'Fibra', 'Prometheo'] as const).find(tab => 
          (laserData[tab] || []).some(r => r.id === editingRow.id)
        ) || (activeSubTab === 'Tutti' ? 'X252' : activeSubTab as 'X252' | 'Fibra' | 'Prometheo');
        const isFibra = originTab === 'Fibra' || editingRow.softwareEzc;
        const isX252 = originTab === 'X252' || editingRow.softwareScaLaser;
        const colorRows = editingRow.colorRows || [];

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-xl border border-gray-300 max-w-[84rem] w-full overflow-hidden text-gray-900 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-800 to-indigo-950 text-white px-6 py-4 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings size={20} className="text-amber-400" />
                  Scheda Lavorazione: {editingRow.materiale || 'Nuovo Materiale'}
                  <span className={`text-[10px] border px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider ${
                    originTab === 'Fibra'
                      ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-200'
                      : originTab === 'Prometheo'
                        ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                        : 'bg-blue-500/20 border-blue-400/30 text-blue-200'
                  }`}>
                    {originTab}
                  </span>
                </h3>
                <button
                  onClick={() => { setIsModalOpen(false); setEditingRow(null); }}
                  className="text-white/80 hover:text-white font-bold text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {/* Form Content in Split Layout */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Material Info (6 columns) */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Associazione Materiale Condiviso */}
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Materiale Condiviso</h4>
                        <span className="text-[10px] text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded-full font-semibold">Sincronizzato</span>
                      </div>
                      
                      {/* Search/Select Shared Material */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Seleziona da elenco condiviso</label>
                        <select
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              const found = sharedMaterials.find(m => m.id === val);
                              if (found) {
                                setEditingRow({
                                  ...editingRow,
                                  materiale: found.name,
                                  spessore: found.thickness
                                });
                              }
                            }
                          }}
                        >
                          <option value="">-- Scegli un materiale per compilare Nome e Spessore --</option>
                          {sharedMaterials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.thickness} mm) {m.cost ? `- €${m.cost.toFixed(2)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-12 gap-4">
                        {/* Nome Materiale */}
                        <div className="col-span-8 space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">Nome Materiale</label>
                          <input
                            type="text"
                            value={editingRow.materiale}
                            onChange={(e) => setEditingRow({ ...editingRow, materiale: e.target.value })}
                            placeholder="Es. Legno Pioppo"
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                          />
                        </div>

                        {/* Spessore (mm) */}
                        <div className="col-span-4 space-y-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">Spessore (mm)</label>
                          <input
                            type="number"
                            step="any"
                            value={editingRow.spessore || ''}
                            onChange={(e) => setEditingRow({ ...editingRow, spessore: parseFloat(e.target.value) || 0 })}
                            placeholder="Es. 4"
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Button to save to shared materials list */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={!editingRow.materiale || editingRow.materiale === 'Nuovo Materiale'}
                          onClick={async () => {
                            if (!editingRow.materiale.trim()) return;
                            try {
                              await addSharedMaterial({
                                name: editingRow.materiale,
                                thickness: editingRow.spessore || 0
                              });
                              alert('Materiale salvato e condiviso con successo!');
                              loadSharedMaterialsData();
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer select-none transition-colors"
                        >
                          <Plus size={14} /> Salva come Materiale Condiviso
                        </button>
                      </div>
                    </div>

                    {/* Orario e Preferiti */}
                    <div className="grid grid-cols-12 gap-4">
                      {/* Orario (Tempo Lavorazione) */}
                      <div className="col-span-6 space-y-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Orario Lavorazione</label>
                        <input
                          type="time"
                          value={editingRow.tempoLavorazione || '00:00'}
                          onChange={(e) => setEditingRow({ ...editingRow, tempoLavorazione: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      {/* Preferiti */}
                      <div className="col-span-6 space-y-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase text-center">Salva nei Preferiti Laser</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (isFavorite) {
                              const dummyEvent = { stopPropagation: () => {} } as any;
                              handleDeletePreset(editingRow.materiale, dummyEvent);
                            } else {
                              handleSaveAsPreset(editingRow);
                            }
                          }}
                          disabled={!editingRow.materiale || editingRow.materiale === 'Nuovo Materiale'}
                          className={`w-full p-2 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all select-none cursor-pointer ${
                            isFavorite
                              ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-xs'
                              : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-600 hover:text-gray-800'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                          <Star
                            size={16}
                            className={isFavorite ? 'fill-current text-white' : 'text-gray-400 hover:text-amber-500'}
                          />
                          <span>{isFavorite ? 'Preferito' : 'Aggiungi Preferito'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Laser Machine Selector */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Associazione Macchina Laser</label>
                        {editingRow.origin && (
                          <button
                            type="button"
                            onClick={() => setEditingRow({ ...editingRow, origin: undefined, softwareLightburn: false, softwareScaLaser: false, softwareEzc: false })}
                            className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> Resetta
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(['X252', 'Fibra', 'Prometheo', 'PHECDA'] as const).map((mach) => (
                          <button
                            key={mach}
                            type="button"
                            onClick={() => {
                              setEditingRow({ 
                                ...editingRow, 
                                origin: mach,
                                softwareLightburn: mach === 'Prometheo' || mach === 'PHECDA',
                                softwareScaLaser: mach === 'X252',
                                softwareEzc: mach === 'Fibra'
                              });
                            }}
                            className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-extrabold text-center transition-all cursor-pointer select-none ${
                              originTab === mach
                                ? mach === 'Fibra'
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                  : mach === 'Prometheo'
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                    : 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-300 text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {mach === 'Fibra' ? '⚡ Fibra' : mach === 'Prometheo' ? '🔥 Prometheo' : mach === 'PHECDA' ? '🧪 PHECDA' : '⚙️ X252'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grid for Potenza & Frequenza (conditional side by side for Fibra) */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Potenza range slider */}
                      <div className={`space-y-1 ${isFibra ? 'col-span-1' : 'col-span-2'}`}>
                        <label className="block text-xs font-bold text-gray-700 uppercase flex justify-between">
                          <span>Potenza</span>
                          <span className="font-mono text-blue-700 font-extrabold text-sm">{(() => {
                            const parsed = parseInt((editingRow.potenza || '50%').replace(/[^0-9]/g, ''), 10);
                            return isNaN(parsed) ? 50 : Math.min(Math.max(parsed, 0), 100);
                          })()}%</span>
                        </label>
                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={(() => {
                              const parsed = parseInt((editingRow.potenza || '50%').replace(/[^0-9]/g, ''), 10);
                              return isNaN(parsed) ? 50 : Math.min(Math.max(parsed, 0), 100);
                            })()}
                            onChange={(e) => setEditingRow({ ...editingRow, potenza: `${e.target.value}%` })}
                            className="w-full h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer accent-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Frequenza - ONLY for Fibra (placed next to Potenza as a textarea) */}
                      {isFibra && (
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">Frequenza</label>
                          <textarea
                            rows={1}
                            value={editingRow.frequenza}
                            onChange={(e) => setEditingRow({ ...editingRow, frequenza: e.target.value })}
                            placeholder="Es. 20000"
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-semibold resize-none"
                          />
                        </div>
                      )}
                    </div>

                      {/* Grid for Velocità & Passaggi on the same row */}
                      <div className="grid grid-cols-3 gap-4">
                        {/* Velocità (numeric input, reduced size) */}
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">Velocità</label>
                          <input
                            type="number"
                            value={editingRow.velocita}
                            onChange={(e) => setEditingRow({ ...editingRow, velocita: e.target.value })}
                            placeholder="Es. 15"
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                          />
                        </div>

                        {/* Passaggi (range slider with values 1 to 10 - reduced horizontal size) */}
                        <div className="space-y-1 col-span-2">
                          <label className="block text-xs font-bold text-gray-700 uppercase flex justify-between">
                            <span>Passaggi</span>
                            <span className="font-mono text-blue-700 font-extrabold text-sm">{(() => {
                              const parsed = parseInt((editingRow.passaggi || '1').replace(/[^0-9]/g, ''), 10);
                              return isNaN(parsed) ? 1 : Math.min(Math.max(parsed, 1), 10);
                            })()}</span>
                          </label>
                          <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 h-[38px]">
                            <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={(() => {
                                const parsed = parseInt((editingRow.passaggi || '1').replace(/[^0-9]/g, ''), 10);
                                return isNaN(parsed) ? 1 : Math.min(Math.max(parsed, 1), 10);
                              })()}
                              onChange={(e) => setEditingRow({ ...editingRow, passaggi: e.target.value })}
                              className="w-full h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer accent-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Grid for MODALITA, DPI, PPI */}
                      <div className="grid grid-cols-3 gap-4">
                        {/* MODALITA dropdown */}
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">Modalità</label>
                          <select
                            value={editingRow.modalita || ''}
                            onChange={(e) => setEditingRow({ ...editingRow, modalita: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                          >
                            <option value="">Seleziona</option>
                            <option value="BLACK&WHITE">BLACK&WHITE</option>
                            <option value="MANUAL COLOR">MANUAL COLOR</option>
                            <option value="3D MODE">3D MODE</option>
                            <option value="STAMP MODE">STAMP MODE</option>
                          </select>
                        </div>
                        {/* DPI dropdown */}
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">DPI</label>
                          <select
                            value={editingRow.dpi || ''}
                            onChange={(e) => setEditingRow({ ...editingRow, dpi: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                          >
                            <option value="">Seleziona</option>
                            {[125, 250, 300, 380, 500, 600, 760, 1000].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        {/* PPI numeric input */}
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-bold text-gray-700 uppercase">PPI</label>
                          <input
                            type="number"
                            value={editingRow.ppi || ''}
                            onChange={(e) => setEditingRow({ ...editingRow, ppi: e.target.value })}
                            placeholder="Es. 300"
                            className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Add Color Icons Section */}
                      <div className="space-y-1 pt-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Aggiungi Colore</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { name: 'Rosso', color: '#FF0000' },
                            { name: 'Blu', color: '#0000FF' },
                            { name: 'Verde', color: '#008000' },
                            { name: 'Nero', color: '#000000' },
                            { name: 'Giallo', color: '#FFFF00' },
                            { name: 'Ciano', color: '#00FFFF' },
                            { name: 'Magenta', color: '#FF00FF' },
                            { name: 'Arancione', color: '#FFA500' },
                            { name: 'Viola', color: '#800080' },
                            { name: 'Grigio', color: '#808080' },
                          ].map((c) => (
                            <button
                              key={c.color}
                              type="button"
                              onClick={() => {
                                const currentColorRows = editingRow.colorRows || [];
                                const rowsForColor = currentColorRows.filter(row => row.colorRgb === c.color);

                                if (rowsForColor.length === 0) {
                                  // Create new row, default to vector
                                  const newRow: LaserColorRow = {
                                    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
                                    raster: false,
                                    vector: true,
                                    colorRgb: c.color,
                                    velocita: editingRow.velocita || '',
                                    potenza: editingRow.potenza || '',
                                    passaggi: editingRow.passaggi || '',
                                    frequenza: editingRow.frequenza || '',
                                    modalita: editingRow.modalita || '',
                                    dpi: editingRow.dpi || '',
                                    ppi: editingRow.ppi || ''
                                  };
                                  setEditingRow({
                                    ...editingRow,
                                    colorRows: [...currentColorRows, newRow]
                                  });
                                } else {
                                  // Update ALL existing rows of this color with current main parameters
                                  const updatedRows = currentColorRows.map(row => {
                                    if (row.colorRgb === c.color) {
                                      return {
                                        ...row,
                                        velocita: editingRow.velocita || row.velocita,
                                        potenza: editingRow.potenza || row.potenza,
                                        passaggi: editingRow.passaggi || row.passaggi,
                                        frequenza: editingRow.frequenza || row.frequenza,
                                        modalita: editingRow.modalita || row.modalita,
                                        dpi: editingRow.dpi || row.dpi,
                                        ppi: editingRow.ppi || row.ppi
                                      };
                                    }
                                    return row;
                                  });
                                  setEditingRow({
                                    ...editingRow,
                                    colorRows: updatedRows
                                  });
                                }
                              }}
                              className="w-8 h-8 rounded-full border border-gray-300 shadow-xs hover:scale-110 transition-transform cursor-pointer"
                              style={{ backgroundColor: c.color }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>

                    {/* Checkboxes for Aria & Aspirazione */}
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      {/* Aria */}
                      <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={!!editingRow.aria}
                          onChange={(e) => setEditingRow({ ...editingRow, aria: e.target.checked })}
                          className="w-4.5 h-4.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                          <Wind size={16} className={editingRow.aria ? 'text-blue-600' : 'text-gray-400'} />
                          Aria (Soffio)
                        </div>
                      </label>

                      {/* Aspirazione */}
                      <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none transition-colors">
                        <input
                          type="checkbox"
                          checked={!!editingRow.aspirazione}
                          onChange={(e) => setEditingRow({ ...editingRow, aspirazione: e.target.checked })}
                          className="w-4.5 h-4.5 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                          <Fan size={16} className={editingRow.aspirazione ? 'text-teal-600' : 'text-gray-400'} />
                          Aspirazione
                        </div>
                      </label>
                    </div>

                    {/* Integrated Software Card - converted to Radio Buttons */}
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 shadow-xs">
                      <div className="text-xs font-extrabold text-gray-800 uppercase tracking-wider border-b border-gray-200 pb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">🖥️ Software di Controllo</span>
                        <span className="text-[9px] text-gray-500 font-normal lowercase italic">Assegnato da macchina laser</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* SCA Laser */}
                        <label className={`flex items-center gap-2 p-2 rounded-lg border select-none transition-all ${
                          selectedSoftware === 'scalasering' 
                            ? 'bg-blue-50 border-blue-300 shadow-3xs' 
                            : 'bg-gray-100/50 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}>
                          <input
                            type="radio"
                            name="software-radio"
                            checked={selectedSoftware === 'scalasering'}
                            disabled={true}
                            className="w-4 h-4 text-blue-600 border-gray-300 cursor-not-allowed shrink-0"
                          />
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 truncate">
                            <ScaLaserIcon size={18} className={selectedSoftware === 'scalasering' ? 'opacity-100' : 'opacity-40 grayscale'} />
                            <span className="truncate text-[10px] uppercase">SCA LASER</span>
                          </div>
                        </label>

                        {/* Fibra (EZC) */}
                        <label className={`flex items-center gap-2 p-2 rounded-lg border select-none transition-all ${
                          selectedSoftware === 'ezc' 
                            ? 'bg-amber-50 border-amber-300 shadow-3xs' 
                            : 'bg-gray-100/50 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}>
                          <input
                            type="radio"
                            name="software-radio"
                            checked={selectedSoftware === 'ezc'}
                            disabled={true}
                            className="w-4 h-4 text-amber-600 border-gray-300 cursor-not-allowed shrink-0"
                          />
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 truncate">
                            <EzcIcon size={18} className={selectedSoftware === 'ezc' ? 'opacity-100' : 'opacity-40 grayscale'} />
                            <span className="truncate uppercase">EZCAD</span>
                          </div>
                        </label>

                        {/* Lightburn */}
                        <label className={`flex items-center gap-2 p-2 rounded-lg border select-none transition-all ${
                          selectedSoftware === 'lightburn' 
                            ? 'bg-red-50 border-red-300 shadow-3xs' 
                            : 'bg-gray-100/50 border-gray-200 opacity-50 cursor-not-allowed'
                        }`}>
                          <input
                            type="radio"
                            name="software-radio"
                            checked={selectedSoftware === 'lightburn'}
                            disabled={true}
                            className="w-4 h-4 text-red-600 border-gray-300 cursor-not-allowed shrink-0"
                          />
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 truncate">
                            <LightburnIcon size={18} className={selectedSoftware === 'lightburn' ? 'text-red-700' : 'text-gray-400'} />
                            <span className="truncate uppercase">LIGHTBURN</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Matched Client Selector */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                        <UserIcon size={13} /> Cliente Abbinato
                      </label>
                      <select
                        value={editingRow.clientId || ''}
                        onChange={(e) => setEditingRow({ ...editingRow, clientId: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                      >
                        <option value="">-- Nessun Cliente --</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>
                            {client.intestazione || client.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Notes (Textarea) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase">Note / Consigli di lavorazione</label>
                      <textarea
                        value={editingRow.note || ''}
                        onChange={(e) => setEditingRow({ ...editingRow, note: e.target.value })}
                        placeholder="Inserisci note specifiche o istruzioni per questo materiale..."
                        rows={2}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Right Column: Colors Association (6 columns) */}
                  <div className="lg:col-span-6 h-full">
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-4 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                          <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🎨</span> Colori Laser Associati
                          </h4>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                              <tr>
                                <th className="px-2 py-2 text-center w-[60px]">TIPO</th>
                                <th className="px-2 py-2 w-[50px]">COLORE</th>
                                <th className="px-2 py-2 w-[70px]">VEL</th>
                                <th className="px-2 py-2 w-[70px]">POT</th>
                                {isFibra && <th className="px-2 py-2 w-[70px]">FREQ</th>}
                                {isX252 && (
                                  <>
                                    <th className="px-2 py-2 w-[110px]">MODALITÀ</th>
                                    <th className="px-2 py-2 w-[80px]">DPI</th>
                                    <th className="px-2 py-2 w-[70px]">PPI</th>
                                  </>
                                )}
                                <th className="px-2 py-2 text-center w-[50px]">DEL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150">
                              {colorRows.map((colRow) => (
                                <tr key={colRow.id} className="hover:bg-gray-50/50 transition-colors">
                                  {/* RASTER / VECTOR column grouped */}
                                  <td className="px-2 py-2">
                                    <div className="flex gap-2 items-center justify-center">
                                      <label className="flex items-center gap-1 cursor-pointer" title="Raster">
                                        <input
                                          type="checkbox"
                                          checked={!!colRow.raster}
                                          onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'raster', e.target.checked)}
                                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-[10px] font-bold text-blue-600">R</span>
                                      </label>
                                      <label className="flex items-center gap-1 cursor-pointer" title="Vector">
                                        <input
                                          type="checkbox"
                                          checked={!!colRow.vector}
                                          onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'vector', e.target.checked)}
                                          className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-[10px] font-bold text-indigo-600">V</span>
                                      </label>
                                    </div>
                                  </td>

                                  {/* COLORE RGB */}
                                  <td className="px-2 py-2">
                                    <input
                                      type="color"
                                      value={colRow.colorRgb}
                                      onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'colorRgb', e.target.value)}
                                      className="w-7 h-7 rounded-md border border-gray-300 cursor-pointer bg-transparent"
                                      title="Seleziona colore"
                                    />
                                  </td>

                                  {/* VELOCITA */}
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      value={colRow.velocita || ''}
                                      onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'velocita', e.target.value)}
                                      className="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                      placeholder="Vel"
                                    />
                                  </td>
                                  
                                  {/* POTENZA */}
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      value={colRow.potenza || ''}
                                      onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'potenza', e.target.value)}
                                      className="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                      placeholder="Pot"
                                    />
                                  </td>

                                  {/* FREQUENZA */}
                                  {isFibra && (
                                    <td className="px-2 py-2">
                                      <input
                                        type="text"
                                        value={colRow.frequenza || ''}
                                        onChange={(e) => handleUpdateColorRowInEditing(colRow.id, 'frequenza', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                        placeholder="Freq"
                                      />
                                    </td>
                                  )}

                                  {/* X252 PARAMETERS (MODALITÀ, DPI, PPI) */}
                                  {isX252 && (
                                    <>
                                      <td className="px-2 py-2">
                                        <div className="w-full bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-[11px] text-gray-600 font-medium text-center">
                                          {colRow.modalita || '-'}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <div className="w-full bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-[11px] text-gray-600 font-medium text-center">
                                          {colRow.dpi || '-'}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <div className="w-full bg-gray-50 border border-gray-200 rounded px-1.5 py-1 text-[11px] text-gray-600 font-medium text-center">
                                          {colRow.ppi || '-'}
                                        </div>
                                      </td>
                                    </>
                                  )}

                                  {/* DELETE ROW */}
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteColorRowFromEditing(colRow.id)}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all focus:outline-none cursor-pointer"
                                      title="Elimina riga colore"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}

                              {colorRows.length === 0 && (
                                <tr>
                                  <td colSpan={isX252 ? 7 : (isFibra ? 6 : 5)} className="px-2 py-6 text-center text-gray-400 italic">
                                    Nessun colore associato. Clicca su "Aggiungi" per iniziare.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                        💡 <strong>Incisione & Taglio Laser:</strong> Associa i colori del disegno vettoriale. Ad esempio, imposta il colore <strong>#FF0000 (Rosso)</strong> su <span className="font-semibold">VECTOR</span> per tagliare, e <strong>#0000FF (Blu)</strong> su <span className="font-semibold">RASTER</span> per incidere.
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Footer Buttons */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                  {editingRow.lastModifiedBy && (
                    <>
                      <UserIcon size={12} className="text-gray-400" />
                      <span>Ultima modifica di: <strong className="text-gray-700">{editingRow.lastModifiedBy}</strong></span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditingRow(null); }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm transition-all cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveModalRow()}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check size={16} /> Salva Modifiche
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
