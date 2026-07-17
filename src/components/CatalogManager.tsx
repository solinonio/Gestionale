import { useState, useEffect } from 'react';
import { getCatalogItems, addCatalogItem } from '../lib/db';
import { CostItem } from '../types';
import { Plus } from 'lucide-react';

export default function CatalogManager() {
  const [items, setItems] = useState<CostItem[]>([]);

  useEffect(() => {
    const loadItems = () => {
      getCatalogItems().then(setItems);
    };
    loadItems();

    window.addEventListener('database-synced', loadItems);
    return () => {
      window.removeEventListener('database-synced', loadItems);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Catalogo Materiali e Lavorazioni</h3>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={18} /> Nuovo Elemento
        </button>
      </div>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">Nome</th>
              <th className="px-6 py-3">Categoria</th>
              <th className="px-6 py-3">Unità</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.id}-${index}`} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="px-6 py-4">{item.name}</td>
                <td className="px-6 py-4">{item.category}</td>
                <td className="px-6 py-4">{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
