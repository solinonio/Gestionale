import React, { useState, useEffect } from 'react';
import { getCompanyProfile, updateCompanyProfile } from '../lib/db';
import { CompanyInfo } from '../types';
import QuillEditor from './QuillEditor';

export default function ConditionsTextForm() {
  const [profile, setProfile] = useState<CompanyInfo>({ name: '', address: '', cap: '', city: '', phone: '', email: '', vatNumber: '', sdiCode: '', pec: '', presentationText: '', conditionsText: '' });
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

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <QuillEditor 
        value={profile.conditionsText || ''}
        onChange={content => setProfile({...profile, conditionsText: content})}
      />
      <div className="flex justify-end mt-4">
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Salva Condizioni
        </button>
      </div>
    </form>
  );
}
