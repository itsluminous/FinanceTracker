'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react';

interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export function DebugConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const copyLogs = () => {
    const logText = logs.map(log => 
      `${log.timestamp} [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error('Failed to copy logs:', err);
    });
  };

  const clearSiteData = async () => {
    if (confirm('Clear all site data? This will sign you out and refresh the page.')) {
      try {
        // Clear localStorage
        localStorage.clear();
        // Clear sessionStorage
        sessionStorage.clear();
        // Clear cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        // Reload page
        window.location.reload();
      } catch (error) {
        console.error('Error clearing site data:', error);
        alert('Failed to clear site data. Please try manually in browser settings.');
      }
    }
  };

  useEffect(() => {
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      const timestamp = new Date().toLocaleTimeString();
      
      setLogs(prev => [...prev.slice(-99), { type, message, timestamp }]);
    };

    console.log = (...args: unknown[]) => {
      originalLog(...args);
      addLog('log', args);
    };

    console.error = (...args: unknown[]) => {
      originalError(...args);
      addLog('error', args);
    };

    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      addLog('warn', args);
    };

    console.info = (...args: unknown[]) => {
      originalInfo(...args);
      addLog('info', args);
    };

    // Add initial log
    console.log('🐛 Debug console initialized');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-mono"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-[9999] bg-gray-900 text-white shadow-2xl border-t-2 border-blue-500 ${
        isMinimized ? 'h-12' : 'h-80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold">🐛 Debug Console</span>
          <span className="text-xs text-gray-400">({logs.length} logs)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
            title="Copy all logs"
          >
            <Copy size={12} />
            {copySuccess ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={clearSiteData}
            className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded flex items-center gap-1"
            title="Clear site data and reload"
          >
            <Trash2 size={12} />
            Clear Data
          </button>
          <button
            onClick={() => setLogs([])}
            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Clear Logs
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="h-[calc(100%-3rem)] overflow-y-auto p-2 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`py-1 px-2 mb-1 rounded ${
                  log.type === 'error'
                    ? 'bg-red-900/30 text-red-300'
                    : log.type === 'warn'
                    ? 'bg-yellow-900/30 text-yellow-300'
                    : log.type === 'info'
                    ? 'bg-blue-900/30 text-blue-300'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                <span className="text-gray-500 mr-2">{log.timestamp}</span>
                <span className={`mr-2 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warn' ? 'text-yellow-400' :
                  log.type === 'info' ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  [{log.type.toUpperCase()}]
                </span>
                <span className="whitespace-pre-wrap break-all">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}
