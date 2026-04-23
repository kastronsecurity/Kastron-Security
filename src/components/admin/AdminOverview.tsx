import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Monitor, 
  CreditCard, 
  ChevronRight, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  Briefcase,
  Terminal
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, getSeverityFromLevel } from '../../lib/utils';
import { SeverityBadge } from '../ui/StatusElements';

export default function AdminOverview() {
  const [stats, setStats] = useState({
    activeClients: 0,
    pendingRules: 0,
    activeAgents: 0,
    expiringTrials: 0
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Stats
      const [clientsRes, pendingRulesRes, agentsRes, subsRes] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact' }),
        supabase.from('rule_approval_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('agents').select('status'),
        supabase.from('client_subscriptions').select('*')
      ]);

      const activeAgents = agentsRes.data?.filter(a => a.status === 'Active').length || 0;
      
      const expiringTrials = subsRes.data?.filter(s => {
        if (!s.trial_ends_at) return false;
        const daysLeft = (new Date(s.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return daysLeft <= 14 && daysLeft > 0;
      }).length || 0;

      setStats({
        activeClients: clientsRes.count || 0,
        pendingRules: pendingRulesRes.count || 0,
        activeAgents: activeAgents,
        expiringTrials: expiringTrials
      });

      // 2. Fetch Recent Rule Requests
      const { data: requests } = await supabase
        .from('rule_approval_requests')
        .select('*, clients(name)')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(5);
      
      setRecentRequests(requests || []);

      // 3. Fetch Recent Alerts across all clients
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id, description, severity, timestamp, agent_name, clients(name)')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      setRecentAlerts(alerts || []);

    } catch (error) {
      console.error('Error fetching admin overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color, trend }: any) => (
    <div className="p-6 border-r border-neutral-800 last:border-r-0 flex flex-col gap-2 hover:bg-white/[0.01] transition-colors relative group">
      <div className="flex items-center justify-between mb-2">
        <div className={cn("p-2 rounded-lg bg-white/5", color)}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[10px] font-black text-green-500 uppercase tracking-widest">
            <TrendingUp className="w-3 h-3" />
            +12%
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-baseline gap-3 mt-1">
          <h3 className="text-3xl font-black text-white tracking-tighter">{value}</h3>
          <span className={cn("text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", 
            subValue && subValue.includes('!') ? 'bg-red-600/10 text-red-500' : 'text-neutral-500'
          )}>
            {subValue}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Command Center</h2>
          <p className="text-xs text-neutral-500 mt-1">Global platform visibility and infrastructure oversight</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:border-neutral-700 transition-all flex items-center gap-2"
        >
          <Activity className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border border-neutral-800 rounded-xl overflow-hidden bg-black/50 backdrop-blur-xl">
        <StatCard 
          icon={Users} 
          label="Total Clients" 
          value={stats.activeClients} 
          subValue="Registered"
          color="text-blue-500"
          trend
        />
        <StatCard 
          icon={Shield} 
          label="Rule Requests" 
          value={stats.pendingRules} 
          subValue={stats.pendingRules > 0 ? "REQUIRES REVIEW!" : "CLEAR"}
          color={stats.pendingRules > 0 ? "text-red-500" : "text-neutral-500"}
        />
        <StatCard 
          icon={Monitor} 
          label="Active Agents" 
          value={stats.activeAgents} 
          subValue="Online"
          color="text-green-500"
        />
        <StatCard 
          icon={CreditCard} 
          label="Trials Expiring" 
          value={stats.expiringTrials} 
          subValue={stats.expiringTrials > 0 ? "FOLLOW UP!" : "HEALTHY"}
          color={stats.expiringTrials > 0 ? "text-yellow-500" : "text-neutral-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Rule Requests */}
        <div className="lg:col-span-12 xl:col-span-7 bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-2xl shadow-red-600/5">
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Pending Rule Reviews</h3>
            </div>
            <button className="text-[10px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2 hover:text-red-400 transition-colors">
              Manage Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-neutral-900">
            {recentRequests.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                <CheckCircle2 className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Awaiting New Requests</p>
              </div>
            ) : (
              recentRequests.map(req => (
                <div key={req.id} className="p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-between group">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:border-red-500/50 group-hover:text-red-500 transition-all">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-white mb-1 group-hover:text-red-400 transition-colors">{req.rule_name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Client:</span>
                        <span className="text-[10px] font-bold text-blue-400">{req.clients?.name}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-800 mx-1" />
                        <span className="text-[10px] font-bold text-neutral-500">Submitted {new Date(req.submitted_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <SeverityBadge severity={getSeverityFromLevel(req.level)} />
                    <button className="px-4 py-2 bg-red-600 rounded-md text-[10px] font-black text-white uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all">
                      Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Activity Feed */}
        <div className="lg:col-span-12 xl:col-span-5 bg-black border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-neutral-800 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Global Activity Feed</h3>
            </div>
          </div>
          <div className="p-0 max-h-[460px] overflow-y-auto scrollbar-hide divide-y divide-neutral-900">
            {recentAlerts.map((alert, idx) => (
              <div key={alert.id} className="p-4 hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      alert.severity === 'critical' ? "bg-red-500 animate-pulse" :
                      alert.severity === 'high' ? "bg-orange-500" :
                      alert.severity === 'medium' ? "bg-blue-500" : "bg-neutral-500"
                    )} />
                    <span className="text-[11px] font-bold text-white leading-tight uppercase tracking-tight line-clamp-1">{alert.description}</span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-600 font-mono flex-shrink-0">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Client</span>
                    <span className="text-[10px] font-bold text-neutral-400">{alert.clients?.name}</span>
                  </div>
                  <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">{alert.agent_name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
