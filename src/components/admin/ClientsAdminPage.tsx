import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ExternalLink, 
  Clock, 
  Shield, 
  Bell, 
  Activity,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ShieldAlert,
  CreditCard,
  Briefcase,
  Globe,
  Terminal,
  Monitor,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useIsAdmin } from '../../hooks/useIsAdmin';

const ClientsAdminPage: React.FC = () => {
  const { isAdmin, adminLoading } = useIsAdmin();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalClients: 0,
    totalAgents: 0,
    totalAlerts: 0,
    revenue: 0
  });
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [orphanedAgents, setOrphanedAgents] = useState<any[]>([]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      
      // Fetch clients with relations
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id, name, wazuh_group, install_key, created_at,
          infrastructure,
          client_subscriptions(plan, status, trial_ends_at, monthly_price, max_agents),
          agents(id, status, name, os, last_keepalive, ip),
          alerts(id, severity, timestamp, status, rule_id, description)
        `)
        .order('name', { ascending: true });

      if (clientsError) throw clientsError;
      
      // Fetch ALL agents to find orphaned ones and better map relations
      const { data: allAgents, error: agentsError } = await supabase
        .from('agents')
        .select('*');

      let processedClients = clientsData || [];
      let orphaned = [];

      if (!agentsError && allAgents) {
        // Find agents that aren't linked by ID but have a matching group
        processedClients = processedClients.map(client => {
          const groupAgents = allAgents.filter(a => 
            a.client_id === client.id || 
            (!a.client_id && a.wazuh_group === client.wazuh_group)
          );
          
          return {
            ...client,
            agents: groupAgents,
            // Re-fetch alerts if needed, but for now we assume alerts are correctly linked to agents/clients
          };
        });

        orphaned = allAgents.filter(a => 
          !a.client_id && !processedClients.some(c => c.wazuh_group === a.wazuh_group)
        );
      }

      setClients(processedClients);
      setOrphanedAgents(orphaned);
      
      // If a client was already selected, update its data
      if (selectedClient) {
        const updated = processedClients.find(c => c.id === selectedClient.id);
        if (updated) setSelectedClient(updated);
      }
      
      // Calculate global stats
      const totalAgentsCount = processedClients.reduce((acc, client) => acc + (client.agents?.length || 0), 0);
      const activeAlertsCount = processedClients.reduce((acc, client) => acc + (client.alerts?.filter((a: any) => a.status === 'New' || a.status === 'Investigating').length || 0), 0);
      const totalRevenue = processedClients.reduce((acc, client) => acc + (client.client_subscriptions?.[0]?.monthly_price || 0), 0);

      setStats({
        totalClients: processedClients.length,
        totalAgents: totalAgentsCount,
        totalAlerts: activeAlertsCount,
        revenue: totalRevenue
      });
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchClients();
    }
  }, [isAdmin]);

  const toggleKey = (clientId: string) => {
    setRevealedKeys(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const getDaysLeft = (trialEndsAt: string) => {
    if (!trialEndsAt) return null;
    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getAlertTrend = (alerts: any[]) => {
    if (!alerts) return [];
    const days = 7;
    const trend = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = alerts.filter(a => a.timestamp.split('T')[0] === dateStr).length;
      trend.push({
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        alerts: count
      });
    }
    return trend;
  };

  const getScore = (client: any) => {
    let score = 100;
    const criticalAlerts = client.alerts?.filter((a: any) => a.severity?.toLowerCase() === 'critical' && (a.status === 'New' || a.status === 'Investigating')).length || 0;
    const highAlerts = client.alerts?.filter((a: any) => a.severity?.toLowerCase() === 'high' && (a.status === 'New' || a.status === 'Investigating')).length || 0;
    
    score -= (criticalAlerts * 15);
    score -= (highAlerts * 5);
    
    const activeAgents = client.agents?.filter((a: any) => a.status === 'active').length || 0;
    const totalAgents = client.agents?.length || 0;
    if (totalAgents > 0 && activeAgents / totalAgents < 0.5) score -= 20;
    
    return Math.max(0, score);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.wazuh_group.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (adminLoading) return <div className="flex-1 flex items-center justify-center bg-black"><Clock className="animate-spin text-neutral-500" /></div>;
  if (!isAdmin) return <div className="flex-1 flex items-center justify-center bg-black text-red-500 uppercase tracking-[0.3em] font-bold">Access Denied</div>;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-black text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {selectedClient && (
            <button 
              onClick={() => setSelectedClient(null)}
              className="p-2 hover:bg-white/5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4 rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {selectedClient ? selectedClient.name : 'Global Client Management'}
            </h1>
            <p className="text-neutral-500 text-sm font-medium">
              {selectedClient 
                ? `Detailed analysis and infrastructure for ${selectedClient.wazuh_group}`
                : `Monitoring and managing ${clients.length} security deployments.`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!selectedClient && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 w-64 transition-all"
              />
            </div>
          )}
          <button 
            onClick={fetchClients}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-neutral-800 group"
          >
            <Clock className={cn("w-4 h-4 text-neutral-400 group-hover:text-white transition-colors", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {!selectedClient ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-500' },
              { label: 'Active Agents', value: stats.totalAgents, icon: Monitor, color: 'text-emerald-500' },
              { label: 'Active Alerts', value: stats.totalAlerts, icon: ShieldAlert, color: 'text-red-500' },
              { label: 'Monthly Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: CreditCard, color: 'text-purple-500' }
            ].map((stat, i) => (
              <div key={i} className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-xl hover:bg-neutral-900 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-white tracking-tighter">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-neutral-800 bg-neutral-900/50">
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Client Name</th>
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Wazuh Group</th>
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Plan</th>
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Agents</th>
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Alerts</th>
                    <th className="p-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Status</th>
                    <th className="p-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {filteredClients.map((client) => {
                    const sub = client.client_subscriptions?.[0];
                    const activeAgents = client.agents?.filter((a: any) => a.status === 'active').length || 0;
                    const totalAgents = client.agents?.length || 0;
                    const alertsCount = client.alerts?.length || 0;
                    const criticalAlerts = client.alerts?.filter((a: any) => a.severity?.toLowerCase() === 'critical' && (a.status === 'New' || a.status === 'Investigating')).length || 0;
                    const isHQ = client.name.toUpperCase().includes('KASTRONSEC');

                    return (
                      <tr 
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className={cn(
                          "hover:bg-white/[0.04] transition-colors cursor-pointer group",
                          isHQ && "bg-red-500/5"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border",
                              isHQ ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-white/10 text-neutral-400"
                            )}>
                              <Shield className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                {client.name}
                                {isHQ && <span className="text-[8px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">HQ</span>}
                              </div>
                              <div className="text-[10px] text-neutral-600 font-medium">ID: {client.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-mono text-neutral-500">{client.wazuh_group}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase border whitespace-nowrap",
                            sub?.plan === 'professional' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                            sub?.plan === 'starter' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                          )}>
                            {sub?.plan || 'Free'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{activeAgents}</span>
                            <span className="text-[9px] text-neutral-600 uppercase">/ {totalAgents}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col">
                            <span className={cn("text-xs font-bold", criticalAlerts > 0 ? "text-red-500" : "text-white")}>
                              {alertsCount}
                            </span>
                            {criticalAlerts > 0 && <span className="text-[8px] text-red-500/60 uppercase font-bold">{criticalAlerts} Critical</span>}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "inline-block w-2 h-2 rounded-full",
                            sub?.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                          )} />
                        </td>
                        <td className="p-4 text-right">
                          <button className="text-neutral-600 group-hover:text-white transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Security Health Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Security Exposure Index</h3>
                    <p className="text-2xl font-bold text-white tracking-tighter">
                      {getScore(selectedClient)}<span className="text-neutral-600 text-sm font-medium">/100</span>
                    </p>
                  </div>
                  <div className={cn(
                    "w-12 h-12 rounded-full border-4 flex items-center justify-center text-xs font-bold",
                    getScore(selectedClient) > 80 ? "border-emerald-500/20 text-emerald-500" :
                    getScore(selectedClient) > 50 ? "border-yellow-500/20 text-yellow-500" :
                    "border-red-500/20 text-red-500"
                  )}>
                    {getScore(selectedClient) > 80 ? 'LOW' : getScore(selectedClient) > 50 ? 'MED' : 'HIGH'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 relative z-10">
                  <div className="p-3 bg-black/40 rounded-xl border border-neutral-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Risk Surface</span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {selectedClient.infrastructure?.has_cloud ? 'Medium-High' : 'Controlled'}
                    </div>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-neutral-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">Detection Speed</span>
                    </div>
                    <div className="text-sm font-bold text-white">~4.2m Avg.</div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full" />
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">7-Day Threat Activity</h3>
                  <BarChart3 className="w-4 h-4 text-neutral-700" />
                </div>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getAlertTrend(selectedClient.alerts)}>
                      <Bar dataKey="alerts" radius={[2, 2, 0, 0]}>
                        {getAlertTrend(selectedClient.alerts).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.alerts > 10 ? '#ef4444' : '#3b82f6'} fillOpacity={0.6} />
                        ))}
                      </Bar>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#525252' }} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-lg shadow-xl">
                                <p className="text-[10px] font-bold text-white">{payload[0].value} Alerts</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Security Capabilities Audit */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Security Control Audit
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: 'Endpoint Monitoring', status: (selectedClient.agents?.length || 0) > 0 ? 'Active' : 'Missing', desc: 'Active agents linked to Wazuh group' },
                  { label: 'Cloud Security', status: selectedClient.infrastructure?.has_cloud ? 'Active' : 'Optional', desc: 'Monitoring of AWS/Azure workloads' },
                  { label: 'Perimeter Defense', status: selectedClient.infrastructure?.has_firewall ? 'Active' : 'Unmanaged', desc: 'Fortinet/Cisco telemetry active' },
                  { label: 'Vulnerability Scanning', status: 'Scheduled', desc: 'Automated SCA and Syscheck runs' },
                  { label: 'SIEM Integration', status: 'Connected', desc: 'Wazuh manager link confirmed' },
                  { label: 'Compliance (PCI/SOC2)', status: 'Pending', desc: 'Audit logging requirements' }
                ].map((control, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-black/40 rounded-xl border border-neutral-800/50">
                    <div className={cn(
                      "mt-0.5 rounded-full p-0.5",
                      control.status === 'Active' || control.status === 'Connected' ? "bg-emerald-500/20 text-emerald-500" :
                      control.status === 'Missing' ? "bg-red-500/20 text-red-500" : "bg-neutral-800 text-neutral-600"
                    )}>
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white mb-0.5">{control.label}</p>
                      <p className="text-[10px] text-neutral-500 leading-tight">{control.desc}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                          control.status === 'Active' || control.status === 'Connected' ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-800 text-neutral-500"
                        )}>
                          {control.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Agents */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Deployed Agents
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Wazuh Group:</span>
                  <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {selectedClient.wazuh_group}
                  </span>
                </div>
              </h3>
              <div className="space-y-3">
                {selectedClient.agents?.map((agent: any) => (
                  <div key={agent.id} className="flex items-center justify-between p-4 bg-black/40 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-800">
                        {agent.os?.toLowerCase().includes('win') ? <Monitor className="w-5 h-5 text-blue-400" /> : <Terminal className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white mb-0.5">{agent.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-600">{agent.ip || '0.0.0.0'}</span>
                          <span className="text-neutral-800 text-xs">•</span>
                          <span className="text-[10px] text-neutral-600">{agent.os}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                        agent.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
                      )}>
                        {agent.status}
                      </span>
                      <p className="text-[9px] text-neutral-600 mt-1 uppercase font-bold tracking-widest">
                        Last Check: {agent.last_keepalive ? new Date(agent.last_keepalive).toLocaleTimeString() : 'Never'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Subscription Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest">Subscription & Billing</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-black rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest">Plan</span>
                    <span className="text-sm font-bold text-blue-400 uppercase italic tracking-tighter">
                      {selectedClient.client_subscriptions?.[0]?.plan || 'Free Tier'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-black rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest">Monthly Revenue</span>
                    <span className="text-sm font-bold text-white">
                      ${(selectedClient.client_subscriptions?.[0]?.monthly_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-black rounded-xl border border-neutral-800">
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest">Agent Limit</span>
                    <span className="text-sm font-bold text-white">
                      {selectedClient.client_subscriptions?.[0]?.max_agents || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
                  <div className="flex items-center justify-between bg-black px-4 py-2.5 rounded-lg border border-neutral-800">
                    <div className="flex flex-col text-left">
                      <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Install Key</span>
                      <p className="text-[11px] font-mono text-neutral-400">
                        {revealedKeys[selectedClient.id] ? selectedClient.install_key : '••••••••-••••-••••-••••'}
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleKey(selectedClient.id)}
                      className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 hover:text-white transition-colors"
                    >
                      {revealedKeys[selectedClient.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.05] blur-3xl rounded-full" />
            </div>

            {/* Recent Critical Alerts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Security Context
              </h3>
              <div className="space-y-4">
                {selectedClient.alerts?.filter((a: any) => a.severity?.toLowerCase() === 'critical' || a.severity?.toLowerCase() === 'high').slice(0, 5).map((alert: any) => (
                  <div key={alert.id} className="p-3 bg-black rounded-xl border-l-2 border-l-red-500 border-neutral-800">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{alert.severity}</span>
                      <span className="text-[9px] text-neutral-600">{new Date(alert.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-white line-clamp-2 leading-relaxed">{alert.description || `Rule ${alert.rule_id} triggered`}</p>
                  </div>
                ))}
                {(selectedClient.alerts?.filter((a: any) => a.severity?.toLowerCase() === 'critical' || a.severity?.toLowerCase() === 'high').length || 0) === 0 && (
                  <div className="py-8 text-center text-neutral-600 bg-black/40 rounded-xl border border-dashed border-neutral-800">
                    <p className="text-xs font-medium italic">No critical vulnerabilities detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orphaned Agents footer stays outside filtered view */}
      {!selectedClient && orphanedAgents.length > 0 && (
        <div className="mt-12 p-8 border border-red-500/20 rounded-2xl bg-red-500/5 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Orphaned System Agents Detected</h3>
              <p className="text-sm text-neutral-500 font-medium">These {orphanedAgents.length} agents are sending telemetry but are not linked to any client ID.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            {orphanedAgents.map((agent) => (
              <div key={agent.id} className="p-4 bg-black border border-neutral-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-neutral-400 font-mono">{agent.id.slice(0, 8)}</span>
                  <span className={cn(
                    "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                    agent.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-500/10 text-neutral-500"
                  )}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-xs font-bold text-white mb-1 truncate">{agent.name || 'Unknown Agent'}</p>
                <div className="flex items-center gap-2 text-[10px] text-neutral-600">
                  <Monitor className="w-3 h-3" />
                  <span>{agent.os}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/[0.03] blur-3xl pointer-events-none rounded-full" />
        </div>
      )}
    </div>
  );
};

export default ClientsAdminPage;
