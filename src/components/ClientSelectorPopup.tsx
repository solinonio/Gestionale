import { useState, useEffect } from 'react';
import { getClients } from '../lib/db';
import { Client } from '../types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
}

export default function ClientSelectorPopup({ isOpen, onClose, onSelect }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      console.log('Fetching clients...');
      getClients().then(clients => {
        console.log('Clients fetched:', clients);
        setClients(clients);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredClients = clients.filter(client => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    
    const intestazione = (client.intestazione || '').toLowerCase();
    const name = (client.name || '').toLowerCase();
    const vat = (client.vatNumber || '').toLowerCase();
    const city = (client.city || '').toLowerCase();
    
    return intestazione.includes(term) || name.includes(term) || vat.includes(term) || city.includes(term);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Seleziona Cliente</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 cursor-pointer"><X size={20} /></button>
        </div>
        
        <div className="mb-4">
          <input 
            type="text" 
            placeholder="Cerca cliente per nome, intestazione, P.IVA o città..." 
            className="w-full p-2 border border-gray-400 rounded bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4 italic">Nessun cliente trovato.</p>
          ) : (
            filteredClients.map(client => (
              <div 
                key={client.id} 
                onClick={() => { onSelect(client); onClose(); }}
                className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer flex flex-col gap-1 text-gray-900"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-gray-900">
                    {client.intestazione || client.name}
                  </span>
                  {client.vatNumber && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                      P.IVA: {client.vatNumber}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 flex flex-col">
                  {client.name && client.intestazione && client.name.trim() !== client.intestazione.trim() && (
                    <span className="italic">Ragione Sociale: {client.name}</span>
                  )}
                  <span>{client.address ? `${client.address}, ` : ''}{client.cap} {client.city}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
