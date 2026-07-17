import React, { useState } from 'react';
import { X, History, Sparkles, Check, Bug, ChevronDown, ChevronUp, Clock, GitCommit, Search } from 'lucide-react';
import { changelogData, ChangelogEntry } from '../data/changelog';
import { CURRENT_VERSION } from '../lib/githubSync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangelogModal({ isOpen, onClose }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({
    "3.11.0": true, // Default expanded
  });

  if (!isOpen) return null;

  const toggleExpand = (version: string) => {
    setExpandedVersions(prev => ({
      ...prev,
      [version]: !prev[version]
    }));
  };

  const getCategoryBadge = (category: 'feature' | 'improvement' | 'bugfix') => {
    switch (category) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Sparkles size={10} /> NUOVA FUNZIONE
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-950/40 border border-blue-800 text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Check size={10} /> OTTIMIZZAZIONE
          </span>
        );
      case 'bugfix':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-950/40 border border-rose-800 text-rose-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Bug size={10} /> CORREZIONE BUG
          </span>
        );
    }
  };

  const getVersionBadge = (type: 'major' | 'minor' | 'patch') => {
    switch (type) {
      case 'major':
        return (
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
            MAJOR RELEASE
          </span>
        );
      case 'minor':
        return (
          <span className="bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
            UPDATE
          </span>
        );
      case 'patch':
        return (
          <span className="bg-gray-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
            HOTFIX
          </span>
        );
    }
  };

  const filteredChangelog = changelogData.filter(entry => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const matchesVersion = entry.version.toLowerCase().includes(searchLower);
    const matchesTitle = entry.title.toLowerCase().includes(searchLower);
    const matchesChanges = entry.changes.some(change => change.text.toLowerCase().includes(searchLower));
    return matchesVersion || matchesTitle || matchesChanges;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl text-gray-100 overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/60 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950 border border-blue-800/80 rounded-xl text-blue-400">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cronologia Aggiornamenti</h3>
              <p className="text-xs text-gray-400">Registro modifiche e versionamento del software</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-gray-950/40 border-b border-gray-700/40 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Cerca tra le modifiche apportate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700/60 rounded-xl py-2 pl-10 pr-4 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-900/20">
          {filteredChangelog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Clock size={40} className="stroke-1 mb-3" />
              <p className="text-sm">Nessun aggiornamento corrisponde alla ricerca.</p>
            </div>
          ) : (
            <div className="relative border-l border-gray-700/60 ml-3 pl-6 space-y-8">
              {filteredChangelog.map((entry, entryIdx) => {
                const isExpanded = expandedVersions[entry.version] || false;
                
                return (
                  <div key={entry.version} className="relative group">
                    {/* Node Dot on the timeline */}
                    <div className="absolute -left-[31px] top-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-gray-900 border-2 border-blue-500 shadow-md group-hover:border-blue-400 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>

                    <div className="bg-gray-950/40 border border-gray-800/80 hover:border-gray-700/80 rounded-xl overflow-hidden transition-all duration-200">
                      
                      {/* Version Header */}
                      <div 
                        onClick={() => toggleExpand(entry.version)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/25 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-base font-bold text-white font-mono">v{entry.version}</span>
                          {getVersionBadge(entry.type)}
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <Clock size={12} /> {entry.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-400 hidden sm:inline">{entry.title}</span>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                        </div>
                      </div>

                      {/* Version Changes Details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-800/80 bg-gray-950/25 space-y-3.5 animate-in slide-in-from-top-1 duration-200">
                          {/* Title for mobile */}
                          <div className="sm:hidden text-xs font-bold text-gray-300 pb-1 border-b border-gray-800/50">
                            {entry.title}
                          </div>
                          
                          <div className="space-y-3">
                            {entry.changes.map((change, idx) => (
                              <div key={idx} className="flex gap-3 items-start text-xs text-gray-300 leading-relaxed">
                                <div className="shrink-0 mt-0.5">
                                  {getCategoryBadge(change.category)}
                                </div>
                                <div className="flex-1 font-sans">
                                  {change.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700/60 bg-gray-950/60 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <GitCommit size={14} className="text-emerald-500" />
            <span>Versione attuale: <strong>v{CURRENT_VERSION}</strong> (Stabile)</span>
          </div>
          <span>Sviluppato da AI Coding Agent</span>
        </div>

      </div>
    </div>
  );
}
