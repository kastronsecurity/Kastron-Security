import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  ExternalLink,
  Plus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';

interface Case {
  id: string;
  name: string;
  status: string;
  priority: string;
  analyst: string;
  alerts_count: number;
  created_at: string;
  last_updated: string;
  description: string;
}

export default function CasesPage({ user }: { user?: any }) {
  const { currentClient } = useClient();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    fetchCases();
    
    if (!supabase || !currentClient) return;

    const channel = supabase
      .channel('realtime_cases')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'cases',
        filter: `client_id=eq.${currentClient.id}`
      }, () => {
        fetchCases();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, user, currentClient]);

  const fetchCases = async () => {
    if (!supabase || !user || !currentClient) return;
    setLoading(true);
    try {
      const clientId = currentClient.id;
      
      // First try fetching from actual 'cases' table
      let query = supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId);
      
      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      const { data: casesData, error: casesError } = await query.order('created_at', { ascending: false });

      if (!casesError && casesData && casesData.length > 0) {
        setCases(casesData.map(c => ({
          id: c.id,
          name: c.title,
          status: c.status || 'Active',
          priority: (c.severity || 'LOW').toUpperCase(),
          analyst: 'Unassigned',
          alerts_count: 0, 
          created_at: c.created_at,
          last_updated: c.updated_at || c.created_at,
          description: c.title
        })));
        setDebugInfo('');
      } else {
        // Fallback to alert-based count if table is empty or doesn't exist
        let query = supabase
          .from('alerts')
          .select('*')
          .neq('status', 'Closed')
          .eq('client_id', clientId);

        if (statusFilter !== 'ALL') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query.order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching cases:', error);
          setDebugInfo(`Error: ${error.message}`);
          setCases([]);
        } else {
          if (data && data.length > 0) {
            const mappedCases = data.map(a => ({
              id: a.id.replace('WAZ-', 'CASE-'),
              name: a.description,
              status: a.status || 'Active',
              priority: (a.severity || 'LOW').toUpperCase(),
              analyst: 'Unassigned',
              alerts_count: 1,
              created_at: a.timestamp,
              last_updated: a.timestamp,
              description: a.description
            }));
            setCases(mappedCases);
            setDebugInfo('');
          } else {
            setCases([]);
            setDebugInfo('No active cases found.');
          }
        }
      }
    } catch (e) {
      console.error('General error in fetchCases:', e);
      setDebugInfo(`General Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  };

  const filteredCases = cases.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Case Management</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Track and manage active security investigations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-blue-600 rounded-md text-[12px] font-medium text-white hover:bg-blue-500 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Case
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Cases', value: cases.length, icon: Briefcase, color: 'text-blue-500' },
          { label: 'High Priority', value: cases.filter(c => c.priority === 'HIGH' || c.priority === 'CRITICAL').length, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Unassigned', value: cases.filter(c => c.analyst === 'Unassigned').length, icon: User, color: 'text-neutral-500' },
        ].map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-6 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={cn("w-4 h-4", stat.color)} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{stat.label}</span>
            </div>
            <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/30 p-4 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</span>
            <div className="flex items-center gap-1.5">
              {['ALL', 'Active', 'Investigating'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1 rounded text-[10px] font-bold transition-all",
                    statusFilter === status 
                      ? "bg-white text-black" 
                      : "text-neutral-500 hover:text-white hover:bg-white/5"
                  )}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input 
            type="text"
            placeholder="Search by Case ID or Name..."
            className="w-full bg-black border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800 bg-white/[0.01] uppercase tracking-widest font-bold text-[10px]">
              <th className="px-6 py-4">Case ID & Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Alerts</th>
              <th className="px-6 py-4">Analyst</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-neutral-500 font-medium">Loading cases...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center text-neutral-500">
                  {debugInfo || 'No cases found matching your criteria.'}
                </td>
              </tr>
            ) : (
              filteredCases.map((c) => (
                <motion.tr 
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-blue-500 font-bold tracking-tighter">{c.id}</span>
                      <span className="text-white font-medium text-[12px]">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-6 py-5">
                    <SeverityBadge severity={c.priority} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5 bg-neutral-900 w-fit px-2 py-0.5 rounded border border-neutral-800">
                      <ShieldAlert className="w-3 h-3 text-neutral-500" />
                      <span className="font-bold text-white">{c.alerts_count}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center">
                        <User className="w-3 h-3" />
                      </div>
                      <span className="font-medium">{c.analyst}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-neutral-500 font-mono">
                    {new Date(c.created_at).toLocaleString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 hover:bg-white/10 rounded transition-colors text-neutral-500 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
