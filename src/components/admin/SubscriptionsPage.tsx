import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  ExternalLink, 
  Clock, 
  MoreHorizontal,
  ChevronDown,
  Calendar,
  Zap,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, formatRelativeTime } from '../../lib/utils';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const SubscriptionsPage: React.FC = () => {
  const { isAdmin, adminLoading } = useIsAdmin();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select('*, clients(name, wazuh_group)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubs(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSubscriptions();
    }
  }, [isAdmin]);

  const handleUpdatePlan = async (clientId: string, newPlan: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const prices: Record<string, number> = { beta: 0, starter: 99, professional: 249, business: 499 }
      const maxAgents: Record<string, number> = { beta: 10, starter: 5, professional: 20, business: 50 }

      await supabase.from('client_subscriptions').update({
        plan: newPlan,
        monthly_price: prices[newPlan] || 0,
        max_agents: maxAgents[newPlan] || 5,
        updated_at: new Date().toISOString()
      }).eq('client_id', clientId)

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'subscription_updated',
        target_type: 'client',
        target_id: clientId,
        details: { new_plan: newPlan, price: prices[newPlan] }
      })

      fetchSubscriptions();
    } catch (err) {
      console.error('Update plan failed:', err);
    }
  }

  const handleExtendTrial = async (sub: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const currentExpiry = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date()
      const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000)

      await supabase.from('client_subscriptions').update({
        trial_ends_at: newExpiry.toISOString()
      }).eq('client_id', sub.client_id)

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'trial_extended',
        target_type: 'client',
        target_id: sub.client_id,
        details: { new_expiry: newExpiry.toISOString(), extended_by_days: 30 }
      })

      fetchSubscriptions();
    } catch (err) {
      console.error('Extend trial failed:', err);
    }
  }

  const handleToggleStatus = async (sub: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newStatus = sub.status === 'active' ? 'suspended' : 'active'

      await supabase.from('client_subscriptions').update({
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('client_id', sub.client_id)

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: `subscription_${newStatus}`,
        target_type: 'client',
        target_id: sub.client_id,
        details: { status: newStatus }
      })

      fetchSubscriptions();
    } catch (err) {
      console.error('Toggle status failed:', err);
    }
  }

  if (adminLoading) return <div className="flex-1 flex items-center justify-center bg-black"><Clock className="animate-spin text-neutral-500" /></div>;
  if (!isAdmin) return <div className="flex-1 flex items-center justify-center bg-black text-red-500 uppercase tracking-[0.3em] font-bold">Access Denied</div>;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-black text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Billing & Subscriptions</h1>
          <p className="text-neutral-500 text-sm font-medium">Manage client tiers, quotas, and trial extensions.</p>
        </div>
        <button 
          onClick={fetchSubscriptions}
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
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Tier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Price</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Quota</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Trial Ends</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {subs.map((sub) => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-white font-bold tracking-tight">{sub.clients?.name}</span>
                      <span className="text-[10px] text-neutral-500 font-mono">{sub.clients?.wazuh_group}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="relative inline-block text-left">
                      <select 
                        value={sub.plan}
                        onChange={(e) => handleUpdatePlan(sub.client_id, e.target.value)}
                        className="bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none pr-8 cursor-pointer hover:border-neutral-600 transition-all uppercase tracking-widest"
                      >
                        <option value="beta">Beta</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="business">Business</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded uppercase border",
                      sub.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center font-mono text-[13px] text-white">
                    ${sub.monthly_price}/mo
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-[11px] font-bold text-neutral-400">
                      {sub.max_agents} <span className="text-[9px] text-neutral-600 font-normal">AGENTS</span>
                    </span>
                  </td>
                  <td className="px-6 py-5 text-neutral-400 text-[11px]">
                    {sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button
                         onClick={() => handleExtendTrial(sub)}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-white/5 border border-neutral-800 rounded-lg text-[9px] font-bold text-neutral-400 hover:text-white transition-all uppercase tracking-widest"
                      >
                        +30 Days
                      </button>
                      <button
                        onClick={() => handleToggleStatus(sub)}
                        className={cn(
                          "px-3 py-1.5 border rounded-lg text-[9px] font-bold transition-all uppercase tracking-widest",
                          sub.status === 'active' 
                            ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        )}
                      >
                        {sub.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsPage;
