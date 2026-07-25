import React, { useState, useEffect } from 'react';
import CompanyProfileForm from './CompanyProfileForm';
import ClientManager from './ClientManager';
import PresentationTextForm from './PresentationTextForm';
import ConditionsTextForm from './ConditionsTextForm';
import { 
  Building2, 
  FileText, 
  FileCheck2, 
  Users,
  Trash2,
  Eye,
  Loader2,
  Check,
  Pencil,
  X,
  FileUp,
  FolderOpen,
  Settings
} from 'lucide-react';
import { Client } from '../types';
import { updateClient, saveQuotation, getCompanyProfile } from '../lib/db';

interface Props {
  setActiveTab: (tab: 'home' | 'quotations' | 'anagrafiche' | 'laser' | 'ai') => void;
  selectedClientId?: string | null;
  onClearSelectedClient?: () => void;
  key?: string;
}

export default function Anagrafiche({ setActiveTab, selectedClientId, onClearSelectedClient }: Props) {
  const [activeTopTab, setActiveTopTab] = useState<'azienda' | 'presentazione' | 'condizioni' | null>(null);

  // Shared state between Clienti tab
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const handleSelectClient = (client: Client | null) => {
    setSelectedClient(client);
  };

  return (
    <div className="space-y-8 text-gray-900">
      <div className="flex justify-between items-center">
        <button onClick={() => setActiveTab('quotations')} className="text-gray-700 hover:text-gray-900">&larr; Indietro</button>
      </div>

      {/* Top Tabs */}
      <div className="bg-gray-200 p-6 rounded-lg shadow-sm border border-gray-300">
        <div className="flex border-b border-gray-400 mb-4">
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'azienda' ? null : 'azienda');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'azienda' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <Building2 size={18} /> Azienda
          </button>
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'presentazione' ? null : 'presentazione');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'presentazione' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <FileText size={18} /> Presentazione
          </button>
          <button 
            onClick={() => {
              setActiveTopTab(activeTopTab === 'condizioni' ? null : 'condizioni');
            }} 
            className={`flex items-center gap-2 px-4 py-2 ${activeTopTab === 'condizioni' ? 'border-b-2 border-blue-800 font-bold text-blue-900' : 'text-gray-700'}`}
          >
            <FileCheck2 size={18} /> Condizioni
          </button>
        </div>
        {activeTopTab === 'azienda' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <CompanyProfileForm />
            </div>
        )}
        {activeTopTab === 'presentazione' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <PresentationTextForm />
            </div>
        )}
        {activeTopTab === 'condizioni' && (
            <div>
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTopTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <ConditionsTextForm />
            </div>
        )}
      </div>

      {/* Bottom Section - Client Manager */}
      <div className="bg-gray-200 p-6 rounded-lg shadow-sm border border-gray-300">
        <div className="flex border-b border-gray-400 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-blue-800 font-bold text-blue-900">
            <Users size={18} /> Gestione Clienti
          </div>
        </div>

        <ClientManager 
          initialSelectedClientId={selectedClientId}
          onClearInitialSelectedClientId={onClearSelectedClient}
          selectedClient={selectedClient}
          onSelectClient={handleSelectClient}
        />
      </div>
    </div>
  );
}
