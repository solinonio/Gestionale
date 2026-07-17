import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

export default function LogViewer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: string, ...args: any[]) => {
      const message = args.map(a => {
        if (a instanceof Error) return `${a.message} ${a.stack}`;
        if (typeof a === 'object') return JSON.stringify(a);
        return String(a);
      }).join(' ');
      setLogs(prev => [...prev, `[${type}] ${new Date().toLocaleTimeString()}: ${message}`]);
    };

    console.log = (...args) => { originalLog(...args); addLog('LOG', ...args); };
    console.error = (...args) => { originalError(...args); addLog('ERROR', ...args); };
    console.warn = (...args) => { originalWarn(...args); addLog('WARN', ...args); };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-20 right-4 w-96 h-96 bg-gray-950 border border-gray-700 shadow-2xl rounded-lg z-[100] flex flex-col">
      <div className="p-2 border-b border-gray-700 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400">Log di Sistema</span>
        <div className='flex gap-1'>
            <button onClick={() => setLogs([])} className="p-1 hover:bg-gray-800 rounded text-gray-400"><Trash2 size={14}/></button>
            <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded text-gray-400"><X size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 font-mono text-[10px] space-y-1">
        {logs.map((log, i) => <div key={i} className={log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARN]') ? 'text-amber-400' : 'text-gray-300'}>{log}</div>)}
      </div>
    </div>
  );
}
