import React from 'react';
import { Terminal, Table as TableIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LogViewerProps {
  data: any;
  viewMode: 'raw' | 'table';
  onViewModeChange: (mode: 'raw' | 'table') => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ data, viewMode, onViewModeChange }) => {
  const renderTable = () => {
    if (!data || typeof data !== 'object') return <p className="text-neutral-500 italic">No data available</p>;

    const entries = Object.entries(data);
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-white/[0.02]">
              <th className="px-3 py-2 text-neutral-500 font-bold uppercase tracking-widest">Field</th>
              <th className="px-3 py-2 text-neutral-500 font-bold uppercase tracking-widest">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {entries.map(([key, value]) => (
              <tr key={key} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-3 py-2 text-neutral-400 font-mono align-top w-1/3">{key}</td>
                <td className="px-3 py-2 text-neutral-200 font-mono break-all">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-4 bg-black border border-neutral-800 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Event Data</span>
        </div>
        
        <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          <button
            onClick={() => onViewModeChange('raw')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all",
              viewMode === 'raw' 
                ? "bg-neutral-800 text-white shadow-sm" 
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Terminal className="w-3 h-3" />
            RAW LOG
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all",
              viewMode === 'table' 
                ? "bg-neutral-800 text-white shadow-sm" 
                : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <TableIcon className="w-3 h-3" />
            TABLE
          </button>
        </div>
      </div>

      <div className="bg-neutral-900/30 rounded-lg border border-neutral-800/50 min-h-[100px] max-h-[400px] overflow-y-auto scrollbar-hide">
        {viewMode === 'raw' ? (
          <div className="p-4 overflow-x-auto">
            <pre className="text-[11px] font-mono text-neutral-400 leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="p-2">
            {renderTable()}
          </div>
        )}
      </div>
    </div>
  );
};
