import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Clock, 
  User,
  ShieldCheck,
  Zap,
  CreditCard,
  XCircle,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, formatRelativeTime } from '../../lib/utils';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const AuditLogPage: React.FC = () => {
  const { isAdmin, adminLoading } = useIsAdmin();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin]);

  if (adminLoading) return <div className="flex-1 flex items-center justify-center bg-black"><Clock className="animate-spin text-neutral-500" /></div>;
  if (!isAdmin) return <div className="flex-1 flex items-center justify-center bg-black text-red-500 uppercase tracking-[0.3em] font-bold">Access Denied</div>;

  const getActionStyles = (action: string) => {
    const map: Record<string, { icon: any, color: string, bg: string, border: string }> = {
      rule_approved: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
      rule_rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
      subscription_updated: { icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
      trial_extended: { icon: Clock, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
      client_suspended: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    }
    return map[action] || { icon: Settings, color: 'text-neutral-400', bg: 'bg-neutral-500/10', border: 'border-neutral-500/20' }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-black text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Global Audit Log</h1>
          <p className="text-neutral-500 text-sm font-medium">Historical record of all privileged administrative actions.</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-neutral-800"
        >
          <Clock className={cn("w-4 h-4 text-neutral-400", loading && "animate-spin")} />
        </button>
      </div>

      <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-white/[0.01]">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Administrator</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Target</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-neutral-600 italic">
                    No administrative records found in the audit trail.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const style = getActionStyles(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-white font-medium">{new Date(log.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] text-neutral-600 font-mono">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                            <User className="w-3 h-3 text-neutral-500" />
                          </div>
                          <span className="text-[12px] font-medium text-neutral-300">{log.admin_email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                          style.bg, style.color, style.border
                        )}>
                          <style.icon className="w-3 h-3" />
                          {log.action.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[12px] text-white font-bold tracking-tight">{log.target_name || log.target_id}</span>
                          <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">{log.target_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="max-w-xs overflow-hidden">
                          <p className="text-[11px] text-neutral-500 truncate font-medium">
                            {JSON.stringify(log.details)}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
