import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ExternalLink, 
  Monitor, 
  Activity, 
  CreditCard, 
  Shield, 
  MoreHorizontal,
  ChevronRight,
  Clock,
  Filter,
  Ban,
  RotateCw,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { StatusPill } from '../ui/StatusElements';

export default function AdminClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_subscriptions(*),
          agents(id, status),
          alerts(id, severity, timestamp)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.wazuh_group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTrialDaysRemaining = (subscription: any) => {
    if (!subscription?.trial_ends_at) return null;
    const days = Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Client Infrastructure</h2>
          <p className="text-xs text-neutral-500 mt-1">Tenant management and environment visibility</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-white transition-colors" />
            <input 
              type="text"
              placeholder="Search by client name or group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 bg-neutral-900/50 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-all"
            />
          </div>
          <button className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-black tracking-widest uppercase text-neutral-400 hover:text-white hover:border-neutral-700 transition-all flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Active Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Clock className="w-10 h-10 text-neutral-800 animate-spin mx-auto mb-4" />
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Indexing Client List...</p>
          </div>
        ) : filteredClients.map(client => {
          const sub = client.client_subscriptions?.[0];
          const activeAgents = client.agents?.filter((a: any) => a.status === 'Active').length || 0;
          const totalAgents = client.agents?.length || 0;
          const trialDays = getTrialDaysRemaining(sub);
          const isExpiring = trialDays !== null && trialDays <= 14;

          return (
            <motion.div 
              key={client.id}
              whileHover={{ y: -4 }}
              className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden group hover:border-neutral-700 hover:bg-neutral-900/60 transition-all shadow-2xl shadow-red-600/0 hover:shadow-red-600/5"
            >
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-black border border-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 group-hover:text-red-500 group-hover:border-red-500/30 transition-all">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{client.name}</h3>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">{client.wazuh_group}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                      sub?.plan === 'enterprise' ? 'bg-blue-600 text-white border-blue-500/50' :
                      sub?.plan === 'business' ? 'bg-orange-600/10 text-orange-500 border-orange-500/20' :
                      sub?.plan === 'beta' ? 'bg-neutral-800 text-neutral-400 border-neutral-700/50' :
                      'bg-green-600/10 text-green-500 border-green-500/20'
                    )}>
                      {sub?.plan || 'BETA'}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                      sub?.status === 'active' ? 'bg-green-600/10 text-green-500' : 'bg-red-600/10 text-red-500'
                    )}>
                      {sub?.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-black/40 border border-neutral-800/50 rounded-xl flex flex-col gap-1">
                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Active Agents</span>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-black text-white leading-none">{activeAgents}</span>
                      <span className="text-[10px] text-neutral-600 font-bold mb-0.5">/ {totalAgents}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 border border-neutral-800/50 rounded-xl flex flex-col gap-1">
                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Weekly Alerts</span>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-black text-white leading-none">{client.alerts?.length || 0}</span>
                      <Activity className="w-3.5 h-3.5 text-red-500 mb-1" />
                    </div>
                  </div>
                </div>

                {trialDays !== null && (
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center justify-between",
                    isExpiring ? "bg-red-600/5 border-red-500/20" : "bg-neutral-800/30 border-neutral-700/50"
                  )}>
                    <div className="flex items-center gap-2">
                      <Clock className={cn("w-3.5 h-3.5", isExpiring ? "text-red-500" : "text-neutral-500")} />
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Trial Ends</span>
                    </div>
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", isExpiring ? "text-red-500 animate-pulse" : "text-neutral-300")}>
                      {trialDays} Days Left
                    </span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-300 transition-colors">
                      Suspend
                    </button>
                    <button className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-300 transition-colors">
                      Update DNS
                    </button>
                  </div>
                  <button 
                    onClick={() => { setSelectedClient(client); setIsDetailModalOpen(true); }}
                    className="p-2 bg-red-600/0 hover:bg-red-600/10 border border-transparent hover:border-red-600/30 rounded-lg text-red-500 transition-all group/btn"
                  >
                    <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Client Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            >
               <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{selectedClient.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{selectedClient.wazuh_group}</span>
                      <span className="w-1 h-1 rounded-full bg-neutral-800" />
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">ID: {selectedClient.id}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-12 scrollbar-hide">
                <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Infrastructure Health', value: 'Excellent', icon: Monitor, color: 'text-green-500' },
                    { label: 'Security Score', value: '88/100', icon: Shield, color: 'text-blue-500' },
                    { label: 'Alert Trend', value: 'Down 12%', icon: Activity, color: 'text-orange-500' },
                    { label: 'Subscription', value: selectedClient.client_subscriptions?.[0]?.plan || 'Beta', icon: CreditCard, color: 'text-neutral-500' }
                  ].map(stat => (
                    <div key={stat.label} className="p-6 bg-black border border-neutral-800 rounded-2xl flex flex-col gap-2">
                       <stat.icon className={cn("w-5 h-5 mb-2", stat.color)} />
                       <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{stat.label}</p>
                       <h4 className="text-xl font-bold text-white tracking-tight">{stat.value}</h4>
                    </div>
                  ))}
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-12 xl:col-span-8 space-y-8">
                      <div className="bg-black/50 border border-neutral-800 rounded-3xl p-8">
                         <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-6">Internal Analyst Notes</h4>
                         <textarea 
                           className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 text-sm text-neutral-300 focus:outline-none focus:border-red-500/50 min-h-[200px]"
                           placeholder="Add internal administrative notes about this client environment..."
                         />
                         <div className="mt-4 flex justify-end">
                            <button className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-black text-white uppercase tracking-widest transition-colors">
                               Save Internal Records
                            </button>
                         </div>
                      </div>
                   </div>

                   <div className="lg:col-span-12 xl:col-span-4 space-y-8">
                      <div className="bg-black/50 border border-neutral-800 rounded-3xl p-8">
                         <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-6">Quick Controls</h4>
                         <div className="space-y-3">
                            <button className="w-full py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-[11px] font-black text-neutral-300 uppercase tracking-widest hover:border-red-500/50 hover:bg-red-500/5 hover:text-red-500 transition-all flex items-center justify-center gap-3">
                               <Ban className="w-4 h-4" />
                               Suspend Environment
                            </button>
                            <button className="w-full py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-[11px] font-black text-neutral-300 uppercase tracking-widest hover:border-blue-500/50 hover:bg-blue-500/5 hover:text-blue-500 transition-all flex items-center justify-center gap-3">
                               <RotateCw className="w-4 h-4" />
                               Purge Cache & Refresh Rules
                            </button>
                            <button className="w-full py-4 bg-blue-600 rounded-2xl text-[11px] font-black text-white uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 mt-4">
                               <CreditCard className="w-4 h-4" />
                               Upgrade Subscription
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

