import React, { useState, useEffect } from 'react';
import { Plus, Calculator, Sliders, Euro, Percent, TrendingUp, TrendingDown, Search, Paintbrush } from 'lucide-react';
import { getSharedMaterials, addSharedMaterial } from '../lib/db';
import { SharedMaterial, InternalRow } from '../types';

interface Props {
  onAddInternalRow?: (description: string, cost: number) => void;
  sellingPriceDefault?: number;
  showAddButtons?: boolean;
  internalRows?: InternalRow[];
}

export default function Simulator({ onAddInternalRow, sellingPriceDefault = 0, showAddButtons = true, internalRows = [] }: Props) {
  const [simMaterialName, setSimMaterialName] = useState('');
  const [simSheetCost, setSimSheetCost] = useState(0);
  const [simSheetLength, setSimSheetLength] = useState(100);
  const [simSheetWidth, setSimSheetWidth] = useState(100);
  const [simSheetThickness, setSimSheetThickness] = useState(5);

  const [sharedMaterials, setSharedMaterials] = useState<SharedMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const loadMaterials = async () => {
    try {
      const mats = await getSharedMaterials();
      const sorted = [...mats].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
      setSharedMaterials(sorted);
    } catch (err) {
      console.error('Failed to load shared materials', err);
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

  const handleSaveMaterialToShared = async () => {
    if (!simMaterialName.trim()) return;
    try {
      await addSharedMaterial({
        name: simMaterialName,
        thickness: simSheetThickness,
        cost: simSheetCost,
        length: simSheetLength,
        width: simSheetWidth
      });
      alert('Materiale salvato con successo nei materiali condivisi!');
      setSearchQuery('');
    } catch (err) {
      console.error('Errore nel salvare il materiale', err);
    }
  };

  const filteredSharedMaterials = sharedMaterials.filter(mat =>
    mat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const [simProcLength, setSimProcLength] = useState(50);
  const [simProcWidth, setSimProcWidth] = useState(50);

  const [simLaborCost, setSimLaborCost] = useState(0);
  const [simMachineCost, setSimMachineCost] = useState(0);
  const [simWastePercentage, setSimWastePercentage] = useState(0);

  const [simSellingPrice, setSimSellingPrice] = useState(sellingPriceDefault);
  const [simSellingQuantity, setSimSellingQuantity] = useState(1);

  const [useMultiplier, setUseMultiplier] = useState(false);
  const [simPieceMultiplier, setSimPieceMultiplier] = useState(4);

  // Verniciatura state variables
  const [simPaintCost, setSimPaintCost] = useState(25); // Costo tinta (€)
  const [simPaintVolumeMl, setSimPaintVolumeMl] = useState(750); // Quantità confezione (ml)
  const [simPaintCoverage, setSimPaintCoverage] = useState(10); // Resa stimata (mq/litro)

  // Sync selling price if default changes
  useEffect(() => {
    if (sellingPriceDefault > 0) {
      setSimSellingPrice(sellingPriceDefault);
    }
  }, [sellingPriceDefault]);

  // Calculations
  const costPerM2 = (simSheetLength > 0 && simSheetWidth > 0)
    ? simSheetCost / ((simSheetLength * simSheetWidth) / 10000)
    : 0;

  const multiplier = useMultiplier ? simPieceMultiplier : 1;

  const totalProcCost = (simProcLength > 0 && simProcWidth > 0)
    ? (((simProcLength * simProcWidth * multiplier) / 10000) * costPerM2)
    : 0;

  // Calcolo Verniciatura
  const areaPezzoM2 = (simProcLength * simProcWidth * multiplier) / 10000;
  const paintUsedMl = simPaintCoverage > 0 ? (areaPezzoM2 / simPaintCoverage) * 1000 : 0;
  const paintCostUsed = simPaintVolumeMl > 0 ? (paintUsedMl * (simPaintCost / simPaintVolumeMl)) : 0;
  const roundedPaintCostUsed = Math.round(paintCostUsed * 100) / 100;

  const areaLastra = (simSheetLength * simSheetWidth);
  const areaPezzo = (simProcLength * simProcWidth * multiplier);
  const areaPezzoConScarto = areaPezzo * (1 + simWastePercentage / 100);
  const numeroPezzi = areaPezzoConScarto > 0 ? Math.floor(areaLastra / areaPezzoConScarto) : 0;

  const totalProductionCost = totalProcCost + simLaborCost + simMachineCost;

  // Rich calculations for margin analysis with internalRows and quantity
  const activeRowsTotal = internalRows && internalRows.length > 0 
    ? internalRows.reduce((sum, row) => sum + ((row.quantity || 0) * (row.cost || 0)), 0) 
    : totalProductionCost;

  const singleNet = simSellingPrice - activeRowsTotal;
  const totalGross = simSellingQuantity * simSellingPrice;
  const totalNet = simSellingQuantity * singleNet;

  const profit = totalNet;
  const profitPercentage = totalGross > 0 ? (totalNet / totalGross) * 100 : 0;

  const handleAddMaterial = () => {
    if (onAddInternalRow) {
      const desc = `${simMaterialName || 'Materiale'} (${simProcLength}x${simProcWidth}cm${useMultiplier ? ` x${simPieceMultiplier}pz` : ''}, ${simSheetThickness}mm)`;
      onAddInternalRow(desc, totalProcCost);
    }
  };

  const handleAddOperational = () => {
    if (onAddInternalRow) {
      const desc = `Costi operativi (Consumabili e Finiture: €${simLaborCost.toFixed(2)}, Macchinario: €${simMachineCost.toFixed(2)})`;
      onAddInternalRow(desc, simLaborCost + simMachineCost);
    }
  };

  const handleAddPainting = () => {
    if (onAddInternalRow && roundedPaintCostUsed > 0) {
      const desc = `Verniciatura (${paintUsedMl.toFixed(0)} ml, conf: ${simPaintVolumeMl}ml, resa: ${simPaintCoverage}mq/L)`;
      onAddInternalRow(desc, roundedPaintCostUsed);
    }
  };

  return (
    <div className="bg-gray-200 p-6 rounded-xl border border-gray-300 shadow-sm text-gray-900">
      <div className="flex items-center gap-2 mb-6 border-b border-gray-300 pb-3">
        <Calculator className="text-blue-700" size={24} />
        <h3 className="text-xl font-bold text-gray-900">Simulatore Costi e Margini</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNA 1: Costi Materiale */}
        <div className="bg-white p-4 rounded-xl border border-gray-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">1</span>
              <h4 className="font-bold text-gray-900">Costo Materiale Lastra</h4>
            </div>

            <div className="space-y-4">
              {/* Ricerca Materiale Salvato */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Cerca Materiale Salvato</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Digita per cercare..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 p-2 border border-gray-400 rounded text-sm bg-gray-50 focus:bg-white text-gray-900 focus:outline-blue-600"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setShowDropdown(false);
                      }}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
                    >
                      &times;
                    </button>
                  )}
                </div>
                {showDropdown && filteredSharedMaterials.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute z-25 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {filteredSharedMaterials.map((mat) => (
                        <button
                          key={mat.id}
                          type="button"
                          onClick={() => {
                            setSimMaterialName(mat.name);
                            setSimSheetThickness(mat.thickness);
                            if (mat.cost !== undefined) setSimSheetCost(mat.cost);
                            if (mat.length !== undefined) setSimSheetLength(mat.length);
                            if (mat.width !== undefined) setSimSheetWidth(mat.width);
                            setSearchQuery(mat.name);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-gray-800 flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <span className="font-semibold text-blue-900">{mat.name}</span>
                            <span className="ml-2 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{mat.thickness}mm</span>
                          </div>
                          {mat.cost !== undefined && (
                            <span className="font-mono text-[10px] text-gray-600">
                              {mat.length}x{mat.width}cm - €{mat.cost.toFixed(2)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Materiale</label>
                <input 
                  type="text" 
                  placeholder="E.g. Plexiglass Opaco" 
                  className="w-full p-2 border border-gray-400 rounded text-sm bg-gray-50 focus:bg-white text-gray-900 focus:outline-blue-600" 
                  value={simMaterialName} 
                  onChange={e => setSimMaterialName(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Costo Lastra (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">€</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="w-full pl-7 p-2 border border-gray-400 rounded text-sm bg-gray-50 focus:bg-white text-gray-900 focus:outline-blue-600 font-mono" 
                    value={simSheetCost || ''} 
                    onChange={e => setSimSheetCost(parseFloat(e.target.value) || 0)} 
                  />
                </div>
              </div>

              {/* SLIDERS MATERIALE */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Lunghezza Lastra</span>
                    <span className="font-mono">{simSheetLength} cm</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="300" 
                      className="flex-1 cursor-pointer accent-blue-700" 
                      value={simSheetLength} 
                      onChange={e => setSimSheetLength(parseInt(e.target.value) || 1)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simSheetLength} 
                      onChange={e => setSimSheetLength(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Larghezza Lastra</span>
                    <span className="font-mono">{simSheetWidth} cm</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="300" 
                      className="flex-1 cursor-pointer accent-blue-700" 
                      value={simSheetWidth} 
                      onChange={e => setSimSheetWidth(parseInt(e.target.value) || 1)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simSheetWidth} 
                      onChange={e => setSimSheetWidth(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Spessore Lastra</span>
                    <span className="font-mono">{simSheetThickness} mm</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      className="flex-1 cursor-pointer accent-blue-700" 
                      value={simSheetThickness} 
                      onChange={e => setSimSheetThickness(parseInt(e.target.value) || 1)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simSheetThickness} 
                      onChange={e => setSimSheetThickness(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <span className="block text-xs text-blue-800 font-semibold uppercase tracking-wider mb-1">Costo Materiale Calcolato</span>
              <span className="text-xl font-bold text-blue-900 font-mono">€{costPerM2.toFixed(2)} <span className="text-sm font-normal text-blue-700">/ mq</span></span>
            </div>
          </div>
        </div>

        {/* COLONNA 2: Lavorazione e Costi Operativi */}
        <div className="bg-white p-4 rounded-xl border border-gray-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center">2</span>
              <h4 className="font-bold text-gray-900">Lavorazione & Operativi</h4>
            </div>

            <div className="space-y-4">
              {/* SLIDERS LAVORAZIONE */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 border-b border-gray-200 pb-1">Misure Pezzo Lavorato</span>
                
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Lunghezza Pezzo</span>
                    <span className="font-mono">{simProcLength} cm</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="300" 
                      className="flex-1 cursor-pointer accent-indigo-700" 
                      value={simProcLength} 
                      onChange={e => setSimProcLength(parseInt(e.target.value) || 1)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simProcLength} 
                      onChange={e => setSimProcLength(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Larghezza Pezzo</span>
                    <span className="font-mono">{simProcWidth} cm</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="300" 
                      className="flex-1 cursor-pointer accent-indigo-700" 
                      value={simProcWidth} 
                      onChange={e => setSimProcWidth(parseInt(e.target.value) || 1)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simProcWidth} 
                      onChange={e => setSimProcWidth(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                  </div>
                </div>

                {/* Moltiplicatore Pezzi Toggle */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-750 select-none">
                      <input 
                        type="checkbox" 
                        checked={useMultiplier} 
                        onChange={(e) => setUseMultiplier(e.target.checked)}
                        className="rounded border-gray-400 text-indigo-700 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                      <span>Moltiplica per N° Pezzi</span>
                    </label>
                    {useMultiplier && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">Pezzi:</span>
                        <input 
                          type="number" 
                          min="1"
                          max="1000"
                          value={simPieceMultiplier}
                          onChange={e => setSimPieceMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono font-bold text-gray-900 bg-white"
                        />
                      </div>
                    )}
                  </div>
                  {useMultiplier && (
                    <div className="text-[10px] text-indigo-700 bg-indigo-50 p-1.5 rounded mt-2 border border-indigo-100 font-medium leading-relaxed">
                      Calcolo basato su <strong>{simPieceMultiplier} pz</strong> da {simProcLength}x{simProcWidth} cm (Totale: {simProcLength * simProcWidth * simPieceMultiplier} cm²)
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 italic mt-1">
                  Spessore ereditato: <strong className="text-gray-700">{simSheetThickness} mm</strong>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Materiale Perso (%)</span>
                    <span className="font-mono">{simWastePercentage} %</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    className="w-full cursor-pointer accent-indigo-700" 
                    value={simWastePercentage} 
                    onChange={e => setSimWastePercentage(parseInt(e.target.value) || 0)} 
                  />
                  <div className="mt-3 p-2 bg-indigo-50 border border-indigo-150 rounded text-xs text-indigo-950 font-medium">
                    <div className="flex justify-between items-center">
                      <span>Pezzi calcolati ricavabili:</span>
                      <span className="font-mono font-bold text-indigo-700 text-sm bg-white px-2 py-0.5 rounded border border-indigo-200">{numeroPezzi} pz</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SLIDERS COSTI OPERATIVI (MANODOPERA & MACCHINARIO) */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 border-b border-gray-200 pb-1">Costi Operativi Aggiuntivi</span>
                
                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Consumabili e Finiture (€)</span>
                    <span className="font-mono">€{simLaborCost}</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="1000" 
                      className="flex-1 cursor-pointer accent-indigo-700" 
                      value={simLaborCost} 
                      onChange={e => setSimLaborCost(parseInt(e.target.value) || 0)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simLaborCost} 
                      onChange={e => setSimLaborCost(Math.min(1000, Math.max(0, parseInt(e.target.value) || 0)))} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                    <span>Costo Macchinario (€)</span>
                    <span className="font-mono">€{simMachineCost}</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="1000" 
                      className="flex-1 cursor-pointer accent-indigo-700" 
                      value={simMachineCost} 
                      onChange={e => setSimMachineCost(parseInt(e.target.value) || 0)} 
                    />
                    <input 
                      type="number" 
                      className="w-16 p-1 border border-gray-400 rounded text-xs text-center font-mono" 
                      value={simMachineCost} 
                      onChange={e => setSimMachineCost(Math.min(1000, Math.max(0, parseInt(e.target.value) || 0)))} 
                    />
                  </div>
                </div>
              </div>

              {/* SIMULATORE VERNICIATURA */}
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                  <Paintbrush size={14} className="text-purple-600 animate-pulse" />
                  <span className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Verniciatura</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5" title="Costo della tinta in euro">Costo Tinta (€)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="any"
                      className="w-full p-1 border border-gray-400 rounded text-xs text-center font-mono font-bold bg-white"
                      value={simPaintCost} 
                      onChange={e => setSimPaintCost(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5" title="Quantità in ml della confezione">Quantità (ml)</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full p-1 border border-gray-400 rounded text-xs text-center font-mono font-bold bg-white"
                      value={simPaintVolumeMl} 
                      onChange={e => setSimPaintVolumeMl(parseInt(e.target.value) || 1)} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase mb-0.5" title="Resa a mq dichiarata dal produttore per Litro">Resa (mq/L)</label>
                    <input 
                      type="number" 
                      min="0.1"
                      step="any"
                      className="w-full p-1 border border-gray-400 rounded text-xs text-center font-mono font-bold bg-white"
                      value={simPaintCoverage} 
                      onChange={e => setSimPaintCoverage(parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-250 p-2 rounded text-[10px] space-y-1 text-purple-950 font-medium leading-normal">
                  <div className="flex justify-between">
                    <span>Prodotto Utilizzato:</span>
                    <span className="font-mono font-bold text-purple-900">{paintUsedMl.toFixed(0)} ml</span>
                  </div>
                  <div className="flex justify-between border-t border-purple-200/50 pt-1">
                    <span>Spesa Verniciatura:</span>
                    <span className="font-mono font-bold text-purple-900">€ {roundedPaintCostUsed.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
              <span className="block text-xs text-indigo-800 font-semibold uppercase tracking-wider mb-1">Totale Costo Lavorazione</span>
              <span className="text-lg font-bold text-indigo-900 font-mono">€{totalProcCost.toFixed(2)}</span>
            </div>
            
            {showAddButtons && onAddInternalRow && (
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={handleAddMaterial}
                  className="px-1.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
                  title="Aggiungi pezzo lavorato alla tabella dei costi interni"
                >
                  <Plus size={12} /> + Mat.
                </button>
                <button 
                  onClick={handleAddOperational}
                  className="px-1.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
                  title="Aggiungi manodopera e costo macchina come Costi Operativi"
                >
                  <Plus size={12} /> + Oper.
                </button>
                <button 
                  onClick={handleAddPainting}
                  disabled={roundedPaintCostUsed <= 0}
                  className="px-1.5 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
                  title="Aggiungi costo verniciatura stimato ai costi interni"
                >
                  <Plus size={12} /> + Vernice
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COLONNA 3: Prezzo Vendita, Produzione e Analisi Margini */}
        <div className="bg-white p-4 rounded-xl border border-gray-300 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">3</span>
              <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Analisi Margine / Guadagno</h4>
            </div>

            {/* SEZIONE INPUTS VENDITA */}
            <div className="space-y-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Pezzi in Vendita</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-2 border border-gray-400 rounded text-sm text-center font-mono font-bold bg-white text-gray-900"
                    value={simSellingQuantity} 
                    onChange={e => setSimSellingQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prezzo Singolo (€)</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    placeholder="E.g. 150.00" 
                    className="w-full p-2 border border-gray-400 rounded text-sm text-center font-mono font-bold bg-white text-gray-900" 
                    value={simSellingPrice || ''} 
                    onChange={e => setSimSellingPrice(parseFloat(e.target.value) || 0)} 
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700 border-t border-gray-200/60 pt-2">
                <span>Totale Lordo Vendita:</span>
                <span className="font-mono text-emerald-800 font-bold">€{totalGross.toFixed(2)}</span>
              </div>
            </div>

            {/* RIASSUNTO CAMPI DELLA TABELLA */}
            <div className="space-y-2">
              <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tabella Costi della Pagina</span>
              {internalRows && internalRows.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                  {internalRows.map((row) => (
                    <div key={row.id} className="flex justify-between items-start text-[11px] border-b border-gray-150 pb-1 last:border-0 last:pb-0">
                      <div className="text-gray-700 leading-tight">
                        <span className="font-mono text-[9px] bg-gray-200 text-gray-800 px-1 rounded mr-1">
                          {row.quantity}x
                        </span>
                        {row.description}
                        {row.details && (
                          <span className="block text-[9px] text-gray-500 italic font-normal">
                            {row.details}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-gray-900 font-semibold whitespace-nowrap ml-1">
                        €{((row.quantity || 0) * (row.cost || 0)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-500 italic p-2 bg-gray-50 rounded border border-gray-200 text-center leading-normal">
                  Nessun costo inserito in tabella. Considero costi stimati sopra (€{totalProductionCost.toFixed(2)}).
                </div>
              )}
              <div className="flex justify-between text-xs font-bold text-gray-800 bg-gray-100 p-2 rounded border border-gray-200">
                <span>Totale Costi Tabella:</span>
                <span className="font-mono">€{activeRowsTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* SCHEDA DETTAGLIATA MARGINI */}
            <div className="border-t border-gray-250 pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {/* COLONNA SINISTRA: SINGOLO PEZZO */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <span className="block text-gray-500 text-[9px] uppercase font-bold mb-1 tracking-wider">Singolo Pezzo</span>
                    <div className="flex justify-between mb-0.5 text-gray-700">
                      <span>Prezzo Singolo:</span>
                      <span className="font-mono font-semibold">€{simSellingPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-1.5 text-rose-700">
                      <span>Costi Tabella:</span>
                      <span className="font-mono">€{activeRowsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-1.5 mt-1 font-bold text-emerald-800 flex justify-between items-center bg-emerald-50/50 -mx-2.5 -mb-2.5 p-2 rounded-b-lg">
                    <span>Valore Netto:</span>
                    <span className="font-mono text-xs">€{singleNet.toFixed(2)}</span>
                  </div>
                </div>

                {/* COLONNA DESTRA: VALORI TOTALI LAVORO */}
                <div className="p-2.5 bg-indigo-50/40 border border-indigo-150 rounded-lg flex flex-col justify-between">
                  <div>
                    <span className="block text-indigo-900 text-[9px] uppercase font-bold mb-1 tracking-wider">Valori Totali Lavoro</span>
                    <div className="flex justify-between mb-0.5 text-gray-700">
                      <span>Quantità:</span>
                      <span className="font-mono font-semibold">{simSellingQuantity} pz</span>
                    </div>
                    <div className="flex justify-between mb-1.5 text-indigo-950 font-medium">
                      <span>Lordo Totale:</span>
                      <span className="font-mono">€{totalGross.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t border-indigo-150 pt-1.5 mt-1 font-bold text-emerald-800 flex justify-between items-center bg-emerald-50/80 -mx-2.5 -mb-2.5 p-2 rounded-b-lg">
                    <span>Netto Totale:</span>
                    <span className="font-mono text-xs">€{totalNet.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* INDICATORE DI MARGINE FINALE */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className={`rounded-lg p-2.5 text-center border ${
              profit >= 0 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {profit >= 0 ? (
                  <TrendingUp size={14} className="text-emerald-700" />
                ) : (
                  <TrendingDown size={14} className="text-rose-700" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">Margine Guadagno Netto Totale</span>
              </div>
              <div className="text-xl font-black font-mono">
                {profit >= 0 ? '+' : ''}€{profit.toFixed(2)}
              </div>
              <div className="text-[10px] font-semibold mt-0.5">
                Rapporto Netto/Lordo: <span className="font-mono">{profitPercentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
