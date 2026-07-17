import React, { useState, useEffect } from 'react';
import { getCompanyProfile, updateCompanyProfile } from '../lib/db';
import { CompanyInfo } from '../types';

export default function CompanyProfileForm() {
  const [profile, setProfile] = useState<CompanyInfo>({ name: '', address: '', cap: '', city: '', phone: '', email: '', vatNumber: '', sdiCode: '', pec: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanyProfile().then(data => {
      if (data) setProfile(data);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCompanyProfile(profile);
      alert('Salvataggio avvenuto con successo!');
    } catch (err: any) {
      console.error(err);
      alert(`Errore durante il salvataggio: ${err.message || 'Errore sconosciuto'}`);
    }
  };

  if (loading) return <div>Caricamento...</div>;

  const fields: { key: keyof CompanyInfo; label: string }[] = [
    { key: 'name', label: 'Nome Azienda' },
    { key: 'address', label: 'Indirizzo' },
    { key: 'cap', label: 'CAP' },
    { key: 'city', label: 'Città' },
    { key: 'phone', label: 'Telefono' },
    { key: 'email', label: 'Email' },
    { key: 'vatNumber', label: 'Partita IVA' },
    { key: 'sdiCode', label: 'Codice Univoco (SDI)' },
    { key: 'pec', label: 'PEC' },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-xl font-bold mb-6 text-gray-900">Azienda</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <input 
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                value={profile[key]} 
                onChange={e => setProfile({...profile, [key]: e.target.value})} 
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Salva / Aggiorna
          </button>
        </div>
      </form>
    </div>
  );
}
