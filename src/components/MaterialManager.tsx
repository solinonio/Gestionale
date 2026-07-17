import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit3, ExternalLink, Sliders, Search, 
  Globe, Ruler, Sparkles, RefreshCw, Save, X, ArrowLeft, Copy
} from 'lucide-react';
import { 
  getSharedMaterials, 
  addSharedMaterial, 
  updateSharedMaterial, 
  deleteSharedMaterial 
} from '../lib/db';
import { SharedMaterial } from '../types';

interface Props {
  setActiveTab?: (tab: any) => void;
  key?: string;
}

export default function MaterialManager({ setActiveTab }: Props) {
  const [materials, setMaterials] = useState<SharedMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states (mm units for input form)
  const [name, setName] = useState('');
  const [thicknessMm, setThicknessMm] = useState<number>(3); // 0 - 100 mm
  const [lengthMm, setLengthMm] = useState<number>(1000); // 0 - 3500 mm
  const [widthMm, setWidthMm] = useState<number>(1000); // 0 - 3500 mm
  const [cost, setCost] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [link, setLink] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await getSharedMaterials();
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
      setMaterials(sorted);
      setError(null);
    } catch (err) {
      console.error('Errore nel caricamento dei materiali condivisi:', err);
      setError('Impossibile caricare i materiali dal database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();

    const handleSync = () => {
      loadMaterials();
    };
    window.addEventListener('database-synced', handleSync);
    return () => {
      window.removeEventListener('database-synced', handleSync);
    };
  }, []);

  const resetForm = () => {
    setName('');
    setThicknessMm(3);
    setLengthMm(1000);
    setWidthMm(1000);
    setCost('');
    setSupplier('');
    setLink('');
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Inserire un nome per il materiale.');
      return;
    }

    const materialData: Omit<SharedMaterial, 'id'> = {
      name: name.trim(),
      thickness: thicknessMm,
      cost: cost === '' ? undefined : Number(cost),
      // Store internally in cm (mm / 10) to keep compatibility with existing simulator features
      length: lengthMm / 10,
      width: widthMm / 10,
      link: link.trim(),
      supplier: supplier.trim()
    };

    try {
      if (editingId) {
        await updateSharedMaterial(editingId, materialData);
        alert('Materiale aggiornato con successo!');
      } else {
        await addSharedMaterial(materialData);
        alert('Materiale salvato e condiviso con successo!');
      }
      resetForm();
      loadMaterials();
    } catch (err) {
      console.error(err);
      alert('Errore durante il salvataggio del materiale.');
    }
  };

  const handleEditInit = (mat: SharedMaterial) => {
    setEditingId(mat.id);
    setName(mat.name);
    setThicknessMm(mat.thickness);
    // Convert cm back to mm for input form
    setLengthMm((mat.length || 0) * 10);
    setWidthMm((mat.width || 0) * 10);
    setCost(mat.cost !== undefined ? mat.cost : '');
    setSupplier(mat.supplier || '');
    setLink(mat.link || '');
    
    // Scroll smoothly to form
    const formElement = document.getElementById('material-form-container');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare il materiale "${name}"?`)) {
      try {
        await deleteSharedMaterial(id);
        loadMaterials();
      } catch (err) {
        console.error(err);
        alert('Errore durante l\'eliminazione del materiale.');
      }
    }
  };

  const handleDuplicate = async (mat: SharedMaterial) => {
    try {
      const duplicateData: Omit<SharedMaterial, 'id'> = {
        name: `${mat.name} (Copia)`,
        thickness: mat.thickness,
        cost: mat.cost,
        length: mat.length,
        width: mat.width,
        link: mat.link,
        supplier: mat.supplier
      };
      await addSharedMaterial(duplicateData);
      alert('Materiale duplicato con successo!');
      loadMaterials();
    } catch (err) {
      console.error(err);
      alert('Errore durante la duplicazione del materiale.');
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.supplier && m.supplier.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const ensureAbsoluteUrl = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  return (
    <div className="space-y-6 text-gray-100 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-5 rounded-2xl border border-gray-700 shadow-md">
        <div className="flex items-center gap-3">
          {setActiveTab && (
            <button
              onClick={() => setActiveTab('home')}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Torna alla Home"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600 rounded-lg text-white">
                <Sliders size={20} />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Catalogo Materiali Condivisi</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Gestisci i materiali e le relative dimensioni/spessori per utilizzarli nel Simulatore Costi e nel modulo Lavorazione Laser.
            </p>
          </div>
        </div>
        <button
          onClick={loadMaterials}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-xs font-semibold text-gray-300 transition-all cursor-pointer select-none"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-blue-400' : ''} />
          <span>Sincronizza</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/80 text-rose-300 rounded-xl text-sm flex items-center gap-3">
          <span className="font-bold">Attenzione:</span>
          <span>{error}</span>
        </div>
      )}

      {/* FORM: Scheda Immissione Materiale (FIRST, as requested) */}
      <div id="material-form-container" className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-gray-700 bg-gray-850 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-emerald-950 text-emerald-400 rounded">
              <Sparkles size={16} />
            </span>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {editingId ? 'Modifica Materiale Condiviso' : 'Scheda Immissione Nuovo Materiale'}
            </h3>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Annulla Modifica"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* INFORMAZIONI GENERALI */}
            <div className="space-y-4 bg-gray-950/40 p-4 rounded-xl border border-gray-800">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1">Dati Base</h4>
              
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300">Nome Materiale <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Es. Legno Pioppo, Plexiglass Cast..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300">Fornitore</label>
                <input
                  type="text"
                  placeholder="Es. Materiali Laser Srl, Leroy Merlin..."
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300">Prezzo / Costo Lastra (€)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-300">Link Produttore / Scheda Tecnica</label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Es. www.fornitore.it/materiale"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* SLIDERS LUNGHEZZA & LARGHEZZA */}
            <div className="space-y-5 bg-gray-950/40 p-4 rounded-xl border border-gray-800 md:col-span-1 lg:col-span-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-1">Dimensioni e Spessore (mm)</h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LUNGHEZZA SLIDER 0 - 3500 mm */}
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/80 space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-gray-300 flex items-center gap-1">
                      <Ruler size={13} className="text-blue-400" /> Lunghezza Lastra
                    </span>
                    <span className="text-blue-400 font-mono text-xs font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900">
                      {lengthMm} mm <span className="text-[10px] text-gray-400 font-normal">({(lengthMm / 10).toFixed(1)} cm)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="3500"
                      step="10"
                      value={lengthMm}
                      onChange={(e) => setLengthMm(Number(e.target.value))}
                      className="flex-1 accent-blue-600 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="3500"
                      value={lengthMm}
                      onChange={(e) => setLengthMm(Math.min(3500, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-center font-mono text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>0 mm</span>
                    <span>1750 mm</span>
                    <span>3500 mm</span>
                  </div>
                </div>

                {/* LARGHEZZA SLIDER 0 - 3500 mm */}
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/80 space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-gray-300 flex items-center gap-1">
                      <Ruler size={13} className="text-emerald-400" /> Larghezza Lastra
                    </span>
                    <span className="text-emerald-400 font-mono text-xs font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                      {widthMm} mm <span className="text-[10px] text-gray-400 font-normal">({(widthMm / 10).toFixed(1)} cm)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="3500"
                      step="10"
                      value={widthMm}
                      onChange={(e) => setWidthMm(Number(e.target.value))}
                      className="flex-1 accent-emerald-600 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="3500"
                      value={widthMm}
                      onChange={(e) => setWidthMm(Math.min(3500, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-center font-mono text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>0 mm</span>
                    <span>1750 mm</span>
                    <span>3500 mm</span>
                  </div>
                </div>

                {/* SPESSORE SLIDER 0 - 100 mm */}
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/80 space-y-3 lg:col-span-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-gray-300 flex items-center gap-1">
                      <Sliders size={13} className="text-purple-400" /> Spessore Materiale
                    </span>
                    <span className="text-purple-400 font-mono text-xs font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-900">
                      {thicknessMm} mm
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={thicknessMm}
                      onChange={(e) => setThicknessMm(Number(e.target.value))}
                      className="flex-1 accent-purple-600 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={thicknessMm}
                      onChange={(e) => setThicknessMm(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-20 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-center font-mono text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>0 mm</span>
                    <span>50 mm</span>
                    <span>100 mm</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* SUBMIT ACTIONS */}
          <div className="flex justify-end gap-3 border-t border-gray-800 pt-5">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg text-sm select-none transition-all cursor-pointer"
              >
                Annulla Modifica
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg text-sm flex items-center gap-2 select-none transition-all cursor-pointer shadow-md"
            >
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              <span>{editingId ? 'Salva Modifiche Materiale' : 'Salva e Condividi Materiale'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SEARCH AND MATERIALS TABLE */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
        {/* Search Header */}
        <div className="p-5 border-b border-gray-700 bg-gray-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>Elenco Materiali Archiviati</span>
            <span className="text-xs font-mono font-normal bg-gray-850 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
              {filteredMaterials.length} record
            </span>
          </h3>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Cerca per nome o fornitore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-medium placeholder-gray-500"
            />
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          {filteredMaterials.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-950/60 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  <th className="px-5 py-3">Materiale</th>
                  <th className="px-5 py-3 text-center">Spessore</th>
                  <th className="px-5 py-3 text-center">Dimensioni (mm)</th>
                  <th className="px-5 py-3 text-center">Dimensioni (cm)</th>
                  <th className="px-5 py-3">Fornitore</th>
                  <th className="px-5 py-3 text-right">Prezzo Lastra</th>
                  <th className="px-5 py-3 text-center">Link</th>
                  <th className="px-5 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-sm">
                {filteredMaterials.map((mat) => {
                  const lengthInMm = (mat.length || 0) * 10;
                  const widthInMm = (mat.width || 0) * 10;
                  return (
                    <tr 
                      key={mat.id} 
                      className={`hover:bg-gray-850/60 transition-colors ${editingId === mat.id ? 'bg-blue-950/20' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-white">{mat.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-block bg-purple-950/60 border border-purple-900 text-purple-300 font-bold font-mono text-xs px-2.5 py-0.5 rounded-full">
                          {mat.thickness} mm
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono text-xs text-gray-300">
                        {lengthInMm > 0 || widthInMm > 0 ? `${lengthInMm} x ${widthInMm} mm` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono text-xs text-gray-400">
                        {mat.length || mat.width ? `${mat.length || 0} x ${mat.width || 0} cm` : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-gray-300 text-xs font-medium">
                          {mat.supplier || <span className="text-gray-600 font-normal italic">-</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-emerald-400 font-semibold">
                        {mat.cost !== undefined ? `€ ${mat.cost.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {mat.link ? (
                          <a
                            href={ensureAbsoluteUrl(mat.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center p-1.5 bg-blue-950/40 border border-blue-900/60 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-900/40 transition-colors"
                            title="Apri link produttore"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleDuplicate(mat)}
                            className="p-1.5 bg-gray-850 hover:bg-blue-950/40 border border-gray-700 hover:border-blue-900 rounded-lg text-blue-400 hover:text-blue-300 transition-all cursor-pointer"
                            title="Duplica materiale"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleEditInit(mat)}
                            className="p-1.5 bg-gray-850 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-gray-300 hover:text-white transition-all cursor-pointer"
                            title="Modifica materiale"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(mat.id, mat.name)}
                            className="p-1.5 bg-gray-850 hover:bg-rose-950/40 border border-gray-700 hover:border-rose-900 rounded-lg text-gray-400 hover:text-rose-400 transition-all cursor-pointer"
                            title="Elimina materiale"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Sliders className="mx-auto mb-3 opacity-30" size={40} />
              <p className="text-sm">Nessun materiale trovato corrispondente alla ricerca.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
