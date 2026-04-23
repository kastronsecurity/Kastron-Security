import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Calendar, 
  ArrowUpRight, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  MoreVertical,
  Banknote,
  TrendingDown,
  TrendingUp,
  History,
  X,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

export default function AdminSubscriptions() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'beta' | 'paid' | 'expiring' | 'expired'>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    plan: 'beta',
    status: 'active',
    monthly_price: 0,
    max_agents: 10
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          client_subscriptions(*),
          agents(id)
        `);

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('client_subscriptions').update({
        plan: formData.plan,
        status: formData.status,
        monthly_price: formData.monthly_price,
        max_agents: formData.max_agents,
        updated_at: new Date().toISOString()
      }).eq('client_id', selectedClient.id);

      if (error) throw error;

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'subscription_updated',
        target_type: 'client',
        target_id: selectedClient.id,
        target_name: selectedClient.name,
        details: formData
      });

      setIsEditModalOpen(false);
      fetchSubscriptions();
    } catch (err) {
      console.error('Error updating subscription:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysLeft = (expiry: string) => {
    if (!expiry) return null;
    const diff = new Date(expiry).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const filteredClients = clients.filter(c => {
    const sub = c.client_subscriptions?.[0];
    const daysLeft = sub?.expires_at ? getDaysLeft(sub.expires_at) : null;
    const trialDays = sub?.trial_ends_at ? getDaysLeft(sub.trial_ends_at) : null;
    
    if (filter === 'beta') return sub?.plan === 'beta';
    if (filter === 'paid') return sub?.plan && sub.plan !== 'beta';
    if (filter === 'expiring') return (daysLeft !== null && daysLeft <= 14 && daysLeft > 0) || (trialDays !== null && trialDays <= 14 && trialDays > 0);
    if (filter === 'expired') return (daysLeft !== null && daysLeft <= 0) || (trialDays !== null && trialDays <= 0);
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Monetization & Plans</h2>
          <p className="text-xs text-neutral-500 mt-1">Revenue management and license control</p>
        </div>
        <div className="flex bg-neutral-900/50 p-1 rounded-lg border border-neutral-800">
          {(['all', 'beta', 'paid', 'expiring', 'expired'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                filter === f ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-neutral-500 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="relative overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white/[0.01] border-b border-neutral-800">
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Client Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Plan</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">MRR</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Agents Use</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Trial/Expiry</th>
                <th className="px-6 py-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Clock className="w-8 h-8 text-neutral-800 animate-spin mx-auto mb-4" />
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Syncing Ledger...</p>
                  </td>
                </tr>
              ) : filteredClients.map(client => {
                const sub = client.client_subscriptions?.[0];
                const daysLeft = sub?.expires_at ? getDaysLeft(sub.expires_at) : (sub?.trial_ends_at ? getDaysLeft(sub.trial_ends_at) : null);
                const isExpiring = daysLeft !== null && daysLeft <= 14 && daysLeft > 0;
                const isExpired = daysLeft !== null && daysLeft <= 0;

                return (
                  <tr key={client.id} className={cn(
                    "group hover:bg-white/[0.02] transition-colors",
                    isExpiring && "bg-yellow-600/5",
                    isExpired && "bg-red-600/5"
                  )}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-red-500 transition-colors">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-white tracking-tight">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                        sub?.plan === 'beta' ? 'bg-neutral-800 text-neutral-400 border-neutral-700/50' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'
                      )}>
                        {sub?.plan || 'BETA'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          sub?.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'
                        )} />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          sub?.status === 'active' ? 'text-green-500' : 'text-red-500'
                        )}>{sub?.status || 'Inactive'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-white">{sub?.monthly_price ? `$${sub.monthly_price}` : '$0.00'}</span>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-300">{client.agents?.length || 0}</span>
                          <span className="text-[10px] text-neutral-600 font-bold">/ {sub?.max_agents || 10}</span>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      {daysLeft !== null ? (
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "text-[11px] font-bold",
                            isExpired ? "text-red-500" : isExpiring ? "text-yellow-500" : "text-neutral-400"
                          )}>
                            {isExpired ? 'EXPIRED' : `${daysLeft} Days Left`}
                          </span>
                          <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter">
                            {new Date(sub?.expires_at || sub?.trial_ends_at || '').toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-600 text-[10px] uppercase font-black tracking-widest">Indefinite</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                       <button 
                        onClick={() => {
                          setSelectedClient(client);
                          setFormData({
                            plan: sub?.plan || 'beta',
                            status: sub?.status || 'active',
                            monthly_price: sub?.monthly_price || 0,
                            max_agents: sub?.max_agents || 10
                          });
                          setIsEditModalOpen(true);
                        }}
                        className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:border-red-600/40 hover:bg-red-600/5 transition-all"
                       >
                          Manage Plan
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Subscription Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEditModalOpen(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
             />
             <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-white/[0.02]">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center">
                         <CreditCard className="w-4 h-4 text-red-500" />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Update License: {selectedClient.name}</h3>
                   </div>
                   <button onClick={() => setIsEditModalOpen(false)} className="text-neutral-500 hover:text-white">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="p-8 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Subscription Plan</label>
                      <select 
                        value={formData.plan}
                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                        className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 transition-all"
                      >
                         <option value="beta">Beta (Free Trial)</option>
                         <option value="starter">Starter</option>
                         <option value="professional">Professional</option>
                         <option value="business">Business</option>
                         <option value="enterprise">Enterprise</option>
                      </select>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Monthly Price ($)</label>
                         <input 
                           type="number"
                           value={formData.monthly_price}
                           onChange={(e) => setFormData({ ...formData, monthly_price: parseFloat(e.target.value) })}
                           className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Max Agent Slots</label>
                         <input 
                           type="number"
                           value={formData.max_agents}
                           onChange={(e) => setFormData({ ...formData, max_agents: parseInt(e.target.value) })}
                           className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Account Status</label>
                      <div className="grid grid-cols-2 gap-3">
                         {(['active', 'suspended', 'cancelled', 'expired'] as const).map(s => (
                            <button
                               key={s}
                               onClick={() => setFormData({ ...formData, status: s })}
                               className={cn(
                                  "py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                  formData.status === s ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20" : "bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700"
                               )}
                            >
                               {s}
                            </button>
                         ))}
                      </div>
                   </div>

                   <div className="pt-4 flex items-center justify-end gap-4 border-t border-neutral-800">
                      <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="text-xs font-black text-neutral-500 uppercase tracking-widest hover:text-white"
                      >
                         Cancel
                      </button>
                      <button 
                        disabled={isSubmitting}
                        onClick={handleUpdateSubscription}
                        className="px-8 py-3 bg-red-600 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-red-500 transition-all flex items-center gap-2"
                      >
                         {isSubmitting ? 'Syncing...' : 'Push License Update'}
                         <ArrowUpRight className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

