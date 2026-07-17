import React from 'react';
import { 
  X, 
  ArrowUpCircle, 
  BookOpen, 
  Terminal,
  ExternalLink,
  Info
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  localVersion: string;
  remoteVersion: string;
  onClose: () => void;
  onOpenChangelog: () => void;
  onUpdate: () => void;
}

export default function GitHubUpdatePopup({ isOpen, localVersion, remoteVersion, onClose, onOpenChangelog, onUpdate }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-blue-950/20">
          <div className="flex items-center gap-2.5">
            <ArrowUpCircle className="text-blue-400 animate-pulse" size={22} />
            <h3 className="text-base font-bold text-white">Aggiornamento Programma Rilevato!</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-300 leading-relaxed">
            È stata rilevata una versione più recente del codice dell'applicazione su GitHub rispetto a quella in esecuzione locale.
          </p>

          {/* Versions Comparison */}
          <div className="grid grid-cols-2 gap-3 bg-gray-950/40 p-4 rounded-xl border border-gray-800/80 text-center">
            <div className="bg-gray-900/40 p-2.5 rounded-lg border border-gray-800">
              <span className="block text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Versione Locale</span>
              <span className="text-base font-bold text-gray-400 font-mono">v{localVersion}</span>
            </div>
            <div className="bg-blue-950/20 p-2.5 rounded-lg border border-blue-900/40">
              <span className="block text-[10px] text-blue-400 font-semibold tracking-wider uppercase">Nuova Versione</span>
              <span className="text-lg font-bold text-blue-400 font-mono">v{remoteVersion}</span>
            </div>
          </div>

          {/* Code Update instruction */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <Terminal size={14} className="text-blue-500" />
              <span>Come aggiornare l'applicazione locale:</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Per applicare le ultime modifiche, esegui il comando git pull nella cartella del progetto o scarica l'ultimo sorgente da GitHub:
            </p>
            <div className="bg-gray-900 p-2 rounded border border-gray-800/80 font-mono text-[10px] text-blue-300 select-all">
              git pull origin master
            </div>
          </div>

          <div className="text-xs text-blue-400 bg-blue-950/20 p-3 rounded-lg border border-blue-900/30 flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
            <span>
              Questo aggiornamento riguarda il software e le funzionalità del programma, non andrà a modificare i tuoi preventivi e dati salvati.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-950/40 border-t border-gray-800 flex justify-between items-center gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenChangelog();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 hover:border-gray-600 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all bg-gray-800/50 hover:bg-gray-800"
            title="Mostra elenco completo delle modifiche apportate in questa versione"
          >
            <BookOpen size={14} />
            Vedi Novità
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors rounded-lg"
            >
              Ignora
            </button>
            <button
              onClick={onUpdate}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-900/30 active:scale-95 transition-all rounded-lg flex items-center gap-1.5"
            >
              <ArrowUpCircle size={14} />
              Aggiorna Ora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
