import React, { useState } from 'react';
import { Brain, Send } from 'lucide-react';

export default function AI() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setResponse(data.response);
    } catch (error) {
      setResponse('Errore durante la generazione della risposta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-300 shadow-sm text-gray-900 space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-300 pb-3">
        <Brain className="text-purple-700" size={24} />
        <h3 className="text-xl font-bold text-gray-900">Gemini AI Assistant</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Chiedi qualcosa a Gemini..."
          className="w-full p-3 border border-gray-400 rounded-lg h-32 focus:outline-purple-600"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-purple-800 disabled:bg-gray-400"
        >
          {loading ? 'Generazione...' : <><Send size={18} /> Invia</>}
        </button>
      </form>
      {response && (
        <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
          <h4 className="font-bold text-gray-900 mb-2">Risposta:</h4>
          <p className="text-gray-800 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
}
