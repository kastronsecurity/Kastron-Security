import React, { useState, useEffect } from 'react';
import { 
  Radar, 
  Monitor, 
  Globe, 
  Cpu, 
  Activity, 
  TrendingUp, 
  Sparkles, 
  Search, 
  Filter, 
  ChevronRight, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  Target,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { cn } from '../../lib/utils';

// --- Types ---

interface DriftEvent {
  id?: string;
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  velocity: 'Slow' | 'Fast' | 'Sudden';
  before: any;
  current: any;
  explanation: string;
  entity_name: string;
  entity_type: string;
  created_at: string;
  acknowledged: boolean;
}

interface EntityProfile {
  entity_name: string;
  entity_type: 'host' | 'ip' | 'service_account';
  total_alerts: number;
  baseline: any;
  current: any;
  drifts: DriftEvent[];
  risk_score: number;
  last_seen: string;
}

// --- Helpers ---

const computeSeverityDist = (alerts: any[]) => ({
  Critical: alerts.filter(a => a.severity === 'Critical').length,
  High: alerts.filter(a => a.severity === 'High').length,
  Medium: alerts.filter(a => a.severity === 'Medium').length,
  Low: alerts.filter(a => a.severity === 'Low').length
});

const computeTopRules = (alerts: any[]) => {
  const counts: Record<string, number> = {};
  alerts.forEach(a => { counts[a.rule_id] = (counts[a.rule_id] || 0) + 1; });
  return Object.entries(counts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([rule_id, count]) => ({ rule_id, count, pct: Math.round(count / alerts.length * 100) }));
};

const computeActiveHours = (alerts: any[]) => {
  const hours = new Array(24).fill(0);
  alerts.forEach(a => {
    const h = new Date(a.timestamp).getHours();
    hours[h]++;
  });
  return hours;
};

const computePeakHour = (alerts: any[]) => {
  const hours = computeActiveHours(alerts);
  return hours.indexOf(Math.max(...hours));
};

const computeRiskScore = (drifts: any[]) => {
  let score = 0;
  drifts.forEach(d => {
    if (d.severity === 'Critical') score += 40;
    else if (d.severity === 'High') score += 25;
    else if (d.severity === 'Medium') score += 10;
    else score += 3;
  });
  return Math.min(100, score);
};

const detectDrifts = (baseline: any, current: any, entity: any): DriftEvent[] => {
  const drifts: DriftEvent[] = [];
  const now = new Date().toISOString();

  // 1. Volume drift
  if (baseline.avg_daily_alerts > 0) {
    const ratio = current.avg_daily_alerts / baseline.avg_daily_alerts;
    if (ratio > 3) {
      drifts.push({
        category: 'volume_drift',
        severity: ratio > 10 ? 'Critical' : ratio > 5 ? 'High' : 'Medium',
        velocity: ratio > 10 ? 'Sudden' : 'Fast',
        before: { daily_avg: baseline.avg_daily_alerts.toFixed(1) },
        current: { daily_avg: current.avg_daily_alerts.toFixed(1) },
        explanation: `Alert volume increased ${ratio.toFixed(1)}x — from ${baseline.avg_daily_alerts.toFixed(1)} to ${current.avg_daily_alerts.toFixed(1)} alerts per day. This sudden spike is unusual for ${entity.name}.`,
        entity_name: entity.name,
        entity_type: entity.type,
        created_at: now,
        acknowledged: false
      });
    } else if (ratio < 0.1 && baseline.avg_daily_alerts > 2) {
      drifts.push({
        category: 'volume_drift',
        severity: 'Medium',
        velocity: 'Slow',
        before: { daily_avg: baseline.avg_daily_alerts.toFixed(1) },
        current: { daily_avg: current.avg_daily_alerts.toFixed(1) },
        explanation: `Alert volume dropped significantly — ${entity.name} went from ${baseline.avg_daily_alerts.toFixed(1)} to ${current.avg_daily_alerts.toFixed(1)} daily alerts. This could indicate the entity is offline or logging was disabled.`,
        entity_name: entity.name,
        entity_type: entity.type,
        created_at: now,
        acknowledged: false
      });
    }
  }

  // 2. Geo/IP drift
  if (entity.type === 'host' || entity.type === 'ip') {
    const newIPs = current.unique_ips.filter((ip: string) => !baseline.unique_ips.includes(ip));
    if (newIPs.length > 0) {
      drifts.push({
        category: 'geo_drift',
        severity: newIPs.length > 3 ? 'High' : 'Medium',
        velocity: 'Fast',
        before: { ips: baseline.unique_ips.slice(0, 5) },
        current: { new_ips: newIPs.slice(0, 5) },
        explanation: `${newIPs.length} new source IP(s) appeared that were not seen in the baseline period: ${newIPs.slice(0, 3).join(', ')}${newIPs.length > 3 ? '...' : ''}. This could indicate access from a new location.`,
        entity_name: entity.name,
        entity_type: entity.type,
        created_at: now,
        acknowledged: false
      });
    }
  }

  // 3. Time drift
  const baselinePeak = baseline.peak_hour;
  const currentPeak = current.peak_hour;
  if (Math.abs(baselinePeak - currentPeak) > 4 && current.avg_daily_alerts > 0.5) {
    drifts.push({
      category: 'time_drift',
      severity: 'Medium',
      velocity: 'Fast',
      before: { peak_hour: baselinePeak },
      current: { peak_hour: currentPeak },
      explanation: `${entity.name} used to be most active around ${baselinePeak}:00 but is now most active around ${currentPeak}:00. Activity outside normal hours can indicate unauthorized access.`,
      entity_name: entity.name,
      entity_type: entity.type,
      created_at: now,
      acknowledged: false
    });
  }

  // 4. Severity drift
  const baselineTotal = Object.values(baseline.severity_dist).reduce((a: number, b: number) => a + b, 0);
  const currentTotal = Object.values(current.severity_dist).reduce((a: number, b: number) => a + b, 0);

  const baselineHighPct = (baselineTotal as number) > 0 
    ? (Number(baseline.severity_dist.Critical) + Number(baseline.severity_dist.High)) / Number(baselineTotal)
    : 0;
  const currentHighPct = (currentTotal as number) > 0
    ? (Number(current.severity_dist.Critical) + Number(current.severity_dist.High)) / Number(currentTotal)
    : 0;
  
  if (currentHighPct > baselineHighPct + 0.3 && (Number(current.severity_dist.Critical) + Number(current.severity_dist.High)) > 2) {
    drifts.push({
      category: 'access_drift',
      severity: currentHighPct > 0.7 ? 'Critical' : 'High',
      velocity: 'Fast',
      before: { high_severity_pct: (baselineHighPct * 100).toFixed(0) + '%' },
      current: { high_severity_pct: (currentHighPct * 100).toFixed(0) + '%' },
      explanation: `High/Critical severity alerts increased from ${(baselineHighPct * 100).toFixed(0)}% to ${(currentHighPct * 100).toFixed(0)}% of all alerts for ${entity.name}. This suggests escalating malicious activity.`,
      entity_name: entity.name,
      entity_type: entity.type,
      created_at: now,
      acknowledged: false
    });
  }

  // 5. New rule drift
  const baselineRuleIds = baseline.top_rules.map((r: any) => r.rule_id);
  const newRules = current.top_rules.filter((r: any) => !baselineRuleIds.includes(r.rule_id) && r.count > 2);
  if (newRules.length > 0) {
    drifts.push({
      category: 'access_drift',
      severity: 'High',
      velocity: 'Fast',
      before: { top_rules: baselineRuleIds.slice(0, 3) },
      current: { new_rules: newRules.map((r: any) => r.rule_id).slice(0, 3) },
      explanation: `${newRules.length} new detection rule(s) are now firing for ${entity.name} that never triggered during the baseline period. This indicates new attack techniques.`,
      entity_name: entity.name,
      entity_type: entity.type,
      created_at: now,
      acknowledged: false
    });
  }

  return drifts;
};

// --- Components ---

const DriftSeverityBadge = ({ severity }: { severity: string }) => {
  const colors = {
    Low: "bg-neutral-800 text-neutral-400 border-neutral-700",
    Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    Critical: "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", colors[severity as keyof typeof colors])}>
      {severity}
    </span>
  );
};

const formatRelativeTime = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
};

export default function EntitiesPage() {
  const { currentClient } = useClient();
  const [activeTab, setActiveTab] = useState<'profiles' | 'drifts'>('profiles');
  const [profiles, setProfiles] = useState<EntityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<EntityProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAndCompute = async () => {
    if (!currentClient) return;
    setLoading(true);
    
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: allAlerts } = await supabase
        .from('alerts')
        .select('id, description, severity, timestamp, source_ip, agent_name, rule_id, rule_level')
        .eq('client_id', currentClient.id)
        .gte('timestamp', sixtyDaysAgo)
        .order('timestamp', { ascending: true });

      if (!allAlerts) return;

      const entityMap: Record<string, any> = {};
      allAlerts.forEach(alert => {
        if (alert.agent_name) {
          const key = `host:${alert.agent_name}`;
          if (!entityMap[key]) entityMap[key] = { type: 'host', name: alert.agent_name, alerts: [] };
          entityMap[key].alerts.push(alert);
        }
        if (alert.source_ip && alert.source_ip !== 'N/A') {
          const key = `ip:${alert.source_ip}`;
          if (!entityMap[key]) entityMap[key] = { type: 'ip', name: alert.source_ip, alerts: [] };
          entityMap[key].alerts.push(alert);
        }
      });

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const computedProfiles: EntityProfile[] = Object.values(entityMap).map(entity => {
        const alerts = entity.alerts;
        const baselineAlerts = alerts.filter((a: any) => {
          const t = new Date(a.timestamp);
          return t >= thirtyDaysAgo && t < sevenDaysAgo;
        });
        const currentAlerts = alerts.filter((a: any) => new Date(a.timestamp) >= sevenDaysAgo);

        if (baselineAlerts.length === 0) return null;

        const baselineDays = 23; 
        const baseline = {
          avg_daily_alerts: baselineAlerts.length / baselineDays,
          severity_dist: computeSeverityDist(baselineAlerts),
          top_rules: computeTopRules(baselineAlerts),
          active_hours: computeActiveHours(baselineAlerts),
          unique_ips: [...new Set(baselineAlerts.map((a: any) => a.source_ip).filter(Boolean))],
          peak_hour: computePeakHour(baselineAlerts),
          alert_counts: Array.from({ length: 30 }, (_, i) => {
            const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            return {
              date,
              count: alerts.filter((a: any) => a.timestamp.split('T')[0] === date).length
            };
          })
        };

        const currentDays = 7;
        const current = {
          avg_daily_alerts: currentAlerts.length / currentDays,
          severity_dist: computeSeverityDist(currentAlerts),
          top_rules: computeTopRules(currentAlerts),
          active_hours: computeActiveHours(currentAlerts),
          unique_ips: [...new Set(currentAlerts.map((a: any) => a.source_ip).filter(Boolean))],
          peak_hour: computePeakHour(currentAlerts)
        };

        const drifts = detectDrifts(baseline, current, entity);

        return {
          entity_type: entity.type,
          entity_name: entity.name,
          total_alerts: alerts.length,
          baseline,
          current,
          drifts,
          risk_score: computeRiskScore(drifts),
          last_seen: alerts[alerts.length - 1]?.timestamp
        } as EntityProfile;
      }).filter(Boolean) as EntityProfile[];

      setProfiles(computedProfiles.sort((a, b) => b.risk_score - a.risk_score));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndCompute();
  }, [currentClient]);

  const allDrifts = profiles.flatMap(p => p.drifts);
  const driftedEntities = profiles.filter(p => p.drifts.length > 0).length;
  const criticalDrifts = allDrifts.filter(d => d.severity === 'Critical').length;
  const highRiskProfiles = profiles.filter(p => p.risk_score > 70).length;

  const statsCards = [
    { label: 'Tracked Entities', value: profiles.length, icon: Radar, color: 'text-blue-500' },
    { label: 'Drifted Behaviors', value: driftedEntities, icon: TrendingUp, color: 'text-yellow-500' },
    { label: 'Critical Deviations', value: criticalDrifts, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'High Risk Profiles', value: highRiskProfiles, icon: Sparkles, color: 'text-purple-500' },
  ];

  const filteredProfiles = profiles.filter(p => 
    p.entity_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvestigate = async (drift: DriftEvent) => {
    if (!currentClient) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newCase } = await supabase.from('cases').insert({
        title: `Behavioral Drift: ${drift.entity_name} — ${drift.category.replace('_', ' ').toUpperCase()}`,
        description: drift.explanation,
        status: 'Open',
        severity: drift.severity,
        client_id: currentClient.id,
        agent_name: drift.entity_type === 'host' ? drift.entity_name : null,
        source_ip: drift.entity_type === 'ip' ? drift.entity_name : null,
        narrative: `Automated baseline drift detection flagged anomalous behavior for ${drift.entity_name}.\n\nDrift Category: ${drift.category}\nSeverity: ${drift.severity}\nVelocity: ${drift.velocity}\n\nExplanation: ${drift.explanation}`,
        verdict: 'Pending'
      }).select().single();
      
      if (newCase) {
        window.dispatchEvent(new CustomEvent('navigate', { 
          detail: { 
            page: 'cases', 
            data: { highlightCaseId: newCase.id } 
          } 
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center">
            <Activity className="w-10 h-10 text-blue-500 animate-pulse" />
          </div>
        </div>
        <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] animate-pulse">Computing Behavioral Baselines...</h3>
        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-2">Analyzing 60 days of historical telemetry</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedProfile && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedProfile(null)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute top-0 right-0 bottom-0 w-1/2 bg-neutral-900 border-l border-neutral-800 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    {selectedProfile.entity_type === 'host' ? <Monitor className="w-6 h-6 text-blue-400" /> : <Globe className="w-6 h-6 text-purple-400" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">{selectedProfile.entity_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{selectedProfile.entity_type} Profile</span>
                      <div className="w-1 h-1 rounded-full bg-neutral-700" />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Last seen {formatRelativeTime(selectedProfile.last_seen)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-[9px] font-bold text-neutral-500 uppercase mb-1">Risk Score</p>
                      <span className={cn("text-3xl font-black", selectedProfile.risk_score > 70 ? "text-red-500" : "text-emerald-400")}>{selectedProfile.risk_score}</span>
                   </div>
                   <button onClick={() => setSelectedProfile(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                      <X className="w-6 h-6 text-neutral-500" />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                {/* Volume Chart */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Activity Volume (Last 30 Days)</h4>
                    <span className="text-[9px] font-bold text-neutral-600 uppercase">Alerts per day</span>
                  </div>
                  <div className="h-64 bg-black/40 border border-neutral-800 rounded-2xl p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedProfile.baseline.alert_counts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fill: '#525252' }}
                          tickFormatter={(val) => val.split('-').slice(1).join('/')}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#525252' }} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px', fontSize: '11px' }}
                        />
                        <ReferenceLine x={selectedProfile.baseline.alert_counts[22].date} stroke="#ef4444" strokeDasharray="5 5" label={{ position: 'top', value: 'DRIFT BOUNDARY', fill: '#ef4444', fontSize: 8, fontWeight: 'bold' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                           {selectedProfile.baseline.alert_counts.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={index >= 23 ? '#ef4444' : '#3b82f6'} fillOpacity={0.6} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Detected Drifts */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Behavioral Deviations</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {selectedProfile.drifts.map((drift, i) => (
                      <div key={i} className="p-6 border border-neutral-800 bg-black/40 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-red-400" />
                             <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{drift.category.replace('_', ' ')}</span>
                          </div>
                          <DriftSeverityBadge severity={drift.severity} />
                        </div>
                        <p className="text-sm text-neutral-400 leading-relaxed font-medium">{drift.explanation}</p>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
                              <p className="text-[9px] font-bold text-neutral-500 uppercase mb-2">Baseline</p>
                              {Object.entries(drift.before).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                   <span className="text-[10px] text-neutral-600 uppercase">{k}:</span>
                                   <span className="text-[11px] text-neutral-400 font-bold">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                                </div>
                              ))}
                           </div>
                           <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400">
                              <p className="text-[9px] font-bold text-red-500 uppercase mb-2">Current</p>
                              {Object.entries(drift.current).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                   <span className="text-[10px] text-red-900 uppercase">{k}:</span>
                                   <span className="text-[11px] text-red-300 font-bold">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    ))}
                    {selectedProfile.drifts.length === 0 && (
                      <div className="p-12 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center gap-3">
                         <CheckCircle2 className="w-8 h-8 text-emerald-500/20" />
                         <span className="text-[10px] text-neutral-600 font-bold uppercase">No Significant Drift Detected</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Rules Comparison */}
                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Baseline Rules</h4>
                      <div className="space-y-1">
                         {selectedProfile.baseline.top_rules.map((rule: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-neutral-900/40 border border-neutral-800 rounded-lg">
                               <span className="text-[10px] font-bold text-neutral-500">{rule.rule_id}</span>
                               <span className="text-[10px] text-neutral-600 font-black">{rule.pct}%</span>
                            </div>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Current Rules</h4>
                      <div className="space-y-1">
                         {selectedProfile.current.top_rules.map((rule: any, i: number) => {
                            const isNew = !selectedProfile.baseline.top_rules.find((r: any) => r.rule_id === rule.rule_id);
                            return (
                               <div key={i} className={cn(
                                 "flex items-center justify-between p-3 border rounded-lg",
                                 isNew ? "bg-red-500/10 border-red-500/20" : "bg-neutral-900/40 border-neutral-800"
                               )}>
                                  <span className={cn("text-[10px] font-bold", isNew ? "text-red-400" : "text-neutral-500")}>
                                     {rule.rule_id}
                                     {isNew && <span className="ml-2 text-[7px] bg-red-500 text-white px-1 py-0.5 rounded">NEW</span>}
                                  </span>
                                  <span className={cn("text-[10px] font-black", isNew ? "text-red-400" : "text-neutral-600")}>{rule.pct}%</span>
                               </div>
                            );
                         })}
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-800 bg-black/20">
                 <button 
                   onClick={() => selectedProfile.drifts[0] && handleInvestigate(selectedProfile.drifts[0])}
                   disabled={selectedProfile.drifts.length === 0}
                   className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-neutral-800 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 group"
                 >
                    <Target className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Open Security Case For {selectedProfile.entity_name}
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main UI */}
      <div className="p-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
              <Radar className="w-6 h-6 text-blue-400" />
           </div>
           <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Behavioral Entities</h1>
              <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-0.5 mt-1 border-l-2 border-blue-600 pl-3">Continuous behavioral baselining & drift detection</p>
           </div>
        </div>

        <div className="flex items-center p-1.5 bg-neutral-900 border border-neutral-800 rounded-2xl gap-1">
           <button 
             onClick={() => setActiveTab('profiles')}
             className={cn(
               "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
               activeTab === 'profiles' ? "bg-black text-white shadow-xl" : "text-neutral-500 hover:text-neutral-300"
             )}
           >
              Entity Profiles
           </button>
           <button 
             onClick={() => setActiveTab('drifts')}
             className={cn(
               "px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
               activeTab === 'drifts' ? "bg-black text-white shadow-xl" : "text-neutral-500 hover:text-neutral-300"
             )}
           >
              Drift Events
           </button>
        </div>
      </div>

      <div className="px-8 grid grid-cols-4 gap-6 shrink-0 mb-8">
        {statsCards.map((card, i) => (
          <div key={i} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-2xl space-y-2 group hover:border-neutral-700 transition-all">
             <div className="flex items-center gap-2">
                <card.icon className={cn("w-3.5 h-3.5", card.color)} />
                <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">{card.label}</span>
             </div>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform block origin-left">{card.value}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-8">
        <div className="mb-6 flex items-center justify-between">
           <div className="relative group w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-white transition-colors" />
              <input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hosts, IPs, or accounts..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
              />
           </div>
           <button className="flex items-center gap-2 px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-[10px] font-black text-neutral-500 uppercase tracking-widest hover:text-white hover:border-neutral-700 transition-all">
              <Filter className="w-4 h-4" />
              Filter Baseline Period
           </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-12">
          {activeTab === 'profiles' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProfiles.map((profile, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedProfile(profile)}
                  className={cn(
                    "p-6 border rounded-3xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden",
                    profile.risk_score > 70 ? 'border-red-500/30 bg-red-500/[0.03] shadow-xl shadow-red-500/5' : 
                    profile.risk_score > 40 ? 'border-yellow-500/20 bg-yellow-500/[0.02]' : 
                    'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900'
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110",
                        profile.entity_type === 'host' ? "bg-blue-500/10 border-blue-500/20" : 
                        profile.entity_type === 'ip' ? "bg-purple-500/10 border-purple-500/20" :
                        "bg-emerald-500/10 border-emerald-500/20"
                      )}>
                        {profile.entity_type === 'host' && <Monitor className="w-5 h-5 text-blue-400" />}
                        {profile.entity_type === 'ip' && <Globe className="w-5 h-5 text-purple-400" />}
                        {profile.entity_type === 'service_account' && <Cpu className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[13px] font-black text-white truncate max-w-[120px]">{profile.entity_name}</p>
                        <p className="text-[8px] text-neutral-500 uppercase font-black tracking-[0.2em]">{profile.entity_type}</p>
                      </div>
                    </div>
                    <div className={cn(
                       "text-2xl font-black tracking-tighter",
                       profile.risk_score > 70 ? 'text-red-500' : 
                       profile.risk_score > 40 ? 'text-yellow-400' : 'text-emerald-400'
                    )}>{profile.risk_score}</div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {profile.drifts.map((drift, idx) => (
                       <span key={idx} className={cn(
                         "text-[7px] font-black uppercase px-2 py-1 rounded-lg border",
                         drift.severity === 'Critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                         drift.severity === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                         drift.severity === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                         'bg-neutral-800 text-neutral-500 border-neutral-700'
                       )}>
                          {drift.category.replace('_', ' ')}
                       </span>
                    ))}
                    {profile.drifts.length === 0 && (
                       <span className="text-[7px] font-black text-emerald-500 uppercase px-2 py-1 bg-emerald-500/5 rounded-lg border border-emerald-500/10">Consistent Baseline</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800/40">
                    <div className="space-y-0.5">
                       <span className="text-[8px] font-bold text-neutral-600 uppercase">Alert Density</span>
                       <p className="text-xs font-bold text-white uppercase">{profile.total_alerts} Total</p>
                    </div>
                    <div className="space-y-0.5 text-right">
                       <span className="text-[8px] font-bold text-neutral-600 uppercase">Detection Pulse</span>
                       <p className="text-xs font-bold text-neutral-300">{formatRelativeTime(profile.last_seen)}</p>
                    </div>
                  </div>

                  {profile.risk_score > 50 && (
                    <div className="absolute top-0 right-0 p-1">
                       <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-black/40 border-b border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Entity</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Drift Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Velocity</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Explanation</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Detected</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {allDrifts.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((drift, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                            {drift.entity_type === 'host' ? <Monitor className="w-3.5 h-3.5 text-blue-400" /> : <Globe className="w-3.5 h-3.5 text-purple-400" />}
                            <span className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{drift.entity_name}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{drift.category.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4">
                         <DriftSeverityBadge severity={drift.severity} />
                      </td>
                      <td className="px-6 py-4">
                         <span className={cn(
                           "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border",
                           drift.velocity === 'Sudden' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                         )}>{drift.velocity}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                         <p className="text-[11px] text-neutral-500 truncate group-hover:text-neutral-300 transition-colors">{drift.explanation}</p>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-neutral-600 font-mono">
                         {formatRelativeTime(drift.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button className="p-2 hover:bg-emerald-500/10 rounded-lg text-neutral-600 hover:text-emerald-500 transition-all border border-transparent hover:border-emerald-500/20">
                              <CheckCircle2 className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleInvestigate(drift)}
                             className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
                           >
                              Investigate <ArrowRight className="w-3 h-3" />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allDrifts.length === 0 && (
                <div className="py-24 flex flex-col items-center justify-center text-center gap-4">
                   <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800">
                      <Radar className="w-8 h-8 text-neutral-800" />
                   </div>
                   <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-widest">No Drift Events Recorded</h4>
                      <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-1">All entities are currently tracking within their established baselines</p>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
