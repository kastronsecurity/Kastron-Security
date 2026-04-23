import React, { useState, useEffect } from 'react';
import { 
  List, 
  Search, 
  Filter, 
  Terminal, 
  User, 
  Shield, 
  CreditCard, 
  Ban, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    let color = "bg-neutral-800 text-neutral-400";
    let icon = Terminal;

    if (action.includes('approved')) {
      color = "bg-green-600/10 text-green-500 border border-green-500/20";
      icon = CheckCircle2;
    } else if (action.includes('rejected')) {
      color = "bg-red-600/10 text-red-500 border border-red-500/20";
      icon = Shield;
    } else if (action.includes('subscription')) {
      color = "bg-blue-600/10 text-blue-500 border border-blue-500/20";
      icon = CreditCard;
    } else if (action.includes('suspended')) {
      color = "bg-orange-600/10 text-orange-500 border border-orange-500/20";
      icon = Ban;
    }

    const Icon = icon;
    return (
      <div className={cn("px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5", color)}>
        <Icon className="w-3 h-3" />
        {action.replace('_', ' ')}
      </div>
    );
  };

  const filteredLogs = logs.filter(log => 
    log.admin_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.target_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Governance & Audit</h2>
          <p className="text-xs text-neutral-500 mt-1">Immutable record of administrative operations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-white transition-colors" />
            <input 
              type="text"
              placeholder="Filter by admin, action, or target..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-red-500 transition-all"
            />
          </div>
          <button className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.01] border-b border-neutral-800">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Admin Observer</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Operation</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Target Asset</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Telemetry Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Clock className="w-8 h-8 text-neutral-800 animate-spin mx-auto mb-4" />
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Replaying Records...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-600 italic">
                    No administrative actions recorded in this scope.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white font-mono">{new Date(log.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] text-neutral-600 font-mono tracking-tighter whitespace-nowrap">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                          <User className="w-3 h-3 text-neutral-600" />
                        </div>
                        <span className="text-[11px] font-bold text-neutral-400">{log.admin_email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-white tracking-tight">{log.target_name || 'N/A'}</span>
                        <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">{log.target_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 max-w-md">
                      <div className="bg-neutral-900/50 border border-neutral-800 p-3 rounded-lg flex items-center justify-between group-hover:border-neutral-700 transition-all">
                        <span className="text-[10px] font-mono text-neutral-500 line-clamp-1 truncate">
                          {JSON.stringify(log.details)}
                        </span>
                        <Database className="w-3 h-3 text-neutral-700 flex-shrink-0" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
