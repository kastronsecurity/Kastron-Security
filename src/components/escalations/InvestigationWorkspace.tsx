import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Shield, ShieldAlert, Zap, Search, Activity, Clock, User, 
  ChevronRight, Copy, Code, List, Star, MessageSquare, Anchor, 
  ShieldCheck, Globe, Database, Terminal, AlertTriangle, CheckCircle2,
  MoreVertical, Share2, Printer, Download, Save, Check, Filter,
  ArrowRight, Play, Info, Layers, RefreshCw, FileText, Mail,
  Plus, ExternalLink, Trash2, Edit3, Clipboard, Map, Eye, Target, Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import { LogViewer } from '../ui/LogViewer';
import DOMPurify from 'dompurify';

interface WorkspaceProps {
  esc: any;
  workspace: any;
  data: any;
  loading: boolean;
  onClose: () => void;
  onRunThreatIntel: (ip: string) => void;
  onAddAlertAsEvidence: (alert: any) => void;
  onAddNote: (note: string, isKeyFinding: boolean) => void;
  onToggleKeyFinding: (id: string, isKey: boolean) => void;
  onAddEvidence: (type: string, title: string, description: string, confidence: string) => void;
  onChecklistUpdate: (id: string, checked: boolean) => void;
  onGenerateReport: () => void;
  onBlockIP: (ip: string) => void;
  onAddCurrentFindingsAsEvidence: () => void;
  onShowVerdict: () => void;
}

export const InvestigationWorkspace: React.FC<WorkspaceProps> = ({
  esc, workspace, data, loading, onClose, onRunThreatIntel, onAddAlertAsEvidence,
  onAddNote, onToggleKeyFinding, onAddEvidence, onChecklistUpdate,
  onGenerateReport, onBlockIP, onAddCurrentFindingsAsEvidence, onShowVerdict
}) => {
  const [activeTab, setActiveTab] = useState('timeline');
  const [noteText, setNoteText] = useState('');
  const [isKeyFinding, setIsKeyFinding] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evType, setEvType] = useState('alert');
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evConf, setEvConf] = useState('Medium');
  const [viewingLog, setViewingLog] = useState(false);

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const checklistItems = [
    { id: 'fp_check', label: 'Confirmed this is not a false positive' },
    { id: 'ip_check', label: 'Checked attacker IP reputation' },
    { id: 'agent_check', label: 'Reviewed agent activity before and after' },
    { id: 'related_check', label: 'Searched for related alerts across all agents' },
    { id: 'history_check', label: 'Checked if same IP attacked before' },
    { id: 'blast_check', label: 'Determined blast radius — other affected systems' },
    { id: 'notes_check', label: 'Documented key findings in investigation notes' },
    { id: 'verdict_check', label: 'Ready to set final verdict' },
  ];

  const completedCount = checklistItems.filter(item => workspace?.checklist?.[item.id]).length;
  const progressPercent = (completedCount / 8) * 100;

  const rawLog = typeof data.linkedAlert?.raw_log === 'string' 
    ? JSON.parse(data.linkedAlert.raw_log) 
    : data.linkedAlert?.raw_log;

  const mitre = rawLog?.rule?.mitre || {};
  const mitreIds = mitre.id || [];
  const mitreTactics = mitre.tactic || [];

  const timelineAlerts = data.relatedAlerts.filter((a: any) => 
    a.rule_id === data.linkedAlert?.rule_id ||
    (a.source_ip && a.source_ip === data.linkedAlert?.source_ip)
  ).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const involvedAgents = [...new Set(timelineAlerts.map((a: any) => a.agent_name).filter(Boolean))];

  const threatIntel = data.threatIntel.find((t: any) => t.ip === data.linkedAlert?.source_ip);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
          </div>
        </div>
        <h3 className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">Initializing Investigation Workspace...</h3>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[200] bg-black flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Top Bar */}
      <div className="h-16 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between px-6 shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
              INVESTIGATION WORKSPACE — {esc.escalation_id}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">LIVE — {workspace.opened_by} INVESTIGATING</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all border border-neutral-700 hover:border-neutral-600"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Save & Close</span>
          </button>
          <button 
            onClick={onShowVerdict}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Set Verdict</span>
          </button>
          <div className="w-[1px] h-6 bg-neutral-800 mx-1" />
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-6 h-6 text-neutral-500 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Alert & Timeline */}
        <div className="w-1/3 border-r border-neutral-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* Alert Details Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Info className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Alert Details</h4>
                </div>
                <button 
                  onClick={() => setViewingLog(!viewingLog)}
                  className="flex items-center gap-1.5 text-[9px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                >
                  <Code className="w-3.5 h-3.5" />
                  {viewingLog ? 'View Table' : 'View Raw Log'}
                </button>
              </div>

              {viewingLog ? (
                <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden min-h-[300px]">
                  <LogViewer data={data.linkedAlert?.raw_log} viewMode="raw" onViewModeChange={() => {}} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-1 border border-neutral-800 rounded-xl overflow-hidden">
                    {[
                      { label: 'Alert ID', value: data.linkedAlert?.alert_number },
                      { label: 'Description', value: data.linkedAlert?.description },
                      { label: 'Severity', value: <SeverityBadge severity={data.linkedAlert?.severity} /> },
                      { label: 'Rule ID', value: `${data.linkedAlert?.rule_id} (Level ${rawLog?.rule?.level || 'Unknown'})` },
                      { label: 'Agent', value: data.linkedAlert?.agent_name },
                      { label: 'Source IP', value: (
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono", data.linkedAlert?.source_ip === 'N/A' ? 'text-neutral-600' : 'text-blue-400')}>
                            {data.linkedAlert?.source_ip}
                          </span>
                          {data.linkedAlert?.source_ip !== 'N/A' && (
                            <button onClick={() => navigator.clipboard.writeText(data.linkedAlert.source_ip)} className="p-1 hover:bg-white/10 rounded transition-colors">
                              <Copy className="w-3 h-3 text-neutral-500" />
                            </button>
                          )}
                        </div>
                      )},
                      { label: 'Timestamp', value: data.linkedAlert?.timestamp },
                    ].map((row, i) => (
                      <div key={i} className="grid grid-cols-3 bg-neutral-900/40 p-3 items-center group">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase">{row.label}</span>
                        <div className="col-span-2 text-[11px] font-medium text-neutral-300 tracking-tight">
                          {row.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {mitreIds.map((id: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[9px] font-bold text-purple-400">
                        {id} — {mitreTactics[i] || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Incident Timeline Panel */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Incident Timeline</h4>
              </div>

              <div className="relative pl-4 space-y-6">
                <div className="absolute left-1.5 top-0 bottom-0 w-[1px] bg-neutral-800" />
                {timelineAlerts.length > 0 ? timelineAlerts.map((alert: any, i: number) => {
                  const isTrigger = alert.id === data.linkedAlert?.id;
                  return (
                    <div key={i} className={cn(
                      "relative pl-6 transition-all group",
                      isTrigger && "scale-[1.02]"
                    )}>
                      <div className={cn(
                        "absolute left-[-11px] top-1 w-[10px] h-[10px] rounded-full border-2 border-black z-10",
                        isTrigger ? "bg-red-500" : "bg-neutral-700"
                      )} />
                      <div className={cn(
                        "bg-neutral-900/40 border p-3 rounded-xl hover:bg-neutral-900/60 transition-all",
                        isTrigger ? "border-red-500/30 ring-1 ring-red-500/10" : "border-neutral-800"
                      )}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-neutral-500">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <SeverityBadge severity={alert.severity} />
                          </div>
                          {!isTrigger && (
                            <button 
                              onClick={() => onAddAlertAsEvidence(alert)}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                              title="Add to evidence"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <h6 className="text-[11px] font-bold text-white mb-1 leading-tight">{alert.description}</h6>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">{alert.agent_name}</span>
                          {isTrigger && (
                            <span className="text-[8px] font-black text-red-500 uppercase bg-red-500/10 px-1.5 py-0.5 rounded animate-pulse">
                              ← THIS INCIDENT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-8">
                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest">No related events found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Threat Intelligence & Agent Profile */}
        <div className="w-1/3 border-r border-neutral-800 flex flex-col overflow-hidden bg-neutral-900/20">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* Threat Intel Panel */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                  <ShieldCheck className="w-4 h-4 text-orange-400" />
                </div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Threat Intelligence</h4>
              </div>

              <div className="p-6 bg-black/40 border border-neutral-800 rounded-2xl">
                {threatIntel ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Target IP</span>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-mono font-bold text-white tracking-tighter">{threatIntel.ip}</h3>
                          <button onClick={() => navigator.clipboard.writeText(threatIntel.ip)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                            <Copy className="w-3.5 h-3.5 text-neutral-500" />
                          </button>
                        </div>
                      </div>
                      <div className={cn(
                        "px-4 py-2 rounded-xl border font-black uppercase text-[10px] tracking-[0.2em]",
                        threatIntel.final_verdict === 'Malicious' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                        threatIntel.final_verdict === 'Suspicious' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                        "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                      )}>
                        {threatIntel.final_verdict}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
                      <div>
                        <span className="text-[9px] font-bold text-neutral-600 uppercase block mb-1">Country</span>
                        <div className="flex items-center gap-2">
                           <Globe className="w-3.5 h-3.5 text-neutral-400" />
                           <span className="text-[11px] text-neutral-300 font-bold">{threatIntel.abuseipdb_country}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-neutral-600 uppercase block mb-1">ISP</span>
                        <div className="flex items-center gap-2">
                           <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                           <span className="text-[11px] text-neutral-300 font-bold truncate max-w-[120px]">{threatIntel.abuseipdb_isp}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                        <span className="text-neutral-500">AbuseIPDB Score</span>
                        <span className={threatIntel.abuseipdb_score > 50 ? "text-red-400" : "text-emerald-400"}>{threatIntel.abuseipdb_score}%</span>
                      </div>
                      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={cn(
                          "h-full transition-all duration-1000",
                          threatIntel.abuseipdb_score > 70 ? "bg-red-500" : threatIntel.abuseipdb_score > 30 ? "bg-yellow-500" : "bg-emerald-500"
                        )} style={{ width: `${threatIntel.abuseipdb_score}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">VirusTotal</span>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <span className="block text-[8px] font-bold text-red-500 uppercase">Malicious</span>
                          <span className="text-[12px] font-bold text-white">{threatIntel.vt_malicious}</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-[8px] font-bold text-yellow-500 uppercase">Suspicious</span>
                          <span className="text-[12px] font-bold text-white">{threatIntel.vt_suspicious}</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-[8px] font-bold text-emerald-500 uppercase">Harmless</span>
                          <span className="text-[12px] font-bold text-white">{threatIntel.vt_harmless}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => onAddEvidence('threat_intel', `IP Check: ${threatIntel.ip}`, `Reputation Check for ${threatIntel.ip}. Verdict: ${threatIntel.final_verdict}. Abuse Score: ${threatIntel.abuseipdb_score}%.`, 'High')}
                      className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-neutral-700 hover:border-neutral-600"
                    >
                      Add IP Check as Evidence
                    </button>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                       <Map className="w-8 h-8 text-orange-500/50" />
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-sm font-bold text-white uppercase tracking-widest">No Intelligence Data</h5>
                      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-[200px]">Perform a real-time reputation check on the target source IP.</p>
                    </div>
                    <button 
                      onClick={() => onRunThreatIntel(data.linkedAlert?.source_ip)}
                      disabled={data.linkedAlert?.source_ip === 'N/A' || loading}
                      className="flex items-center gap-3 px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-orange-600/20"
                    >
                      <Target className="w-5 h-5" />
                      Run Threat Intelligence Check
                    </button>
                  </div>
                )}
              </div>

              {/* IP History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Previous Alerts from this IP: {data.ipHistory.length}</h5>
                </div>
                <div className="space-y-2">
                  {data.ipHistory.map((alert: any, i: number) => (
                    <div key={i} className="p-3 bg-black/40 border border-neutral-800 rounded-xl flex items-center justify-between group hover:border-neutral-700 transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-2 h-2 rounded-full bg-neutral-700 group-hover:bg-blue-400 transition-colors shrink-0" />
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold text-white truncate">{alert.description}</p>
                          <span className="text-[9px] text-neutral-600 uppercase font-bold tracking-widest">{alert.agent_name}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <SeverityBadge severity={alert.severity} />
                        <span className="block text-[8px] text-neutral-700 font-mono mt-0.5">{new Date(alert.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {data.ipHistory.length === 0 && (
                     <div className="py-6 border border-dashed border-neutral-800 rounded-xl flex items-center justify-center">
                        <span className="text-[9px] text-neutral-700 font-bold uppercase tracking-widest">No previous history detected</span>
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Agent Profile Panel */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  {involvedAgents.length > 1 ? `Involved Agents (${involvedAgents.length})` : 'Agent Profile'}
                </h4>
              </div>

              {involvedAgents.length > 1 ? (
                <div className="grid grid-cols-2 gap-3">
                  {involvedAgents.map((name: string) => {
                    const agentAlerts = timelineAlerts.filter((a: any) => a.agent_name === name);
                    return (
                      <div key={name} className="p-4 bg-black/40 border border-neutral-800 rounded-2xl hover:border-emerald-500/30 transition-all group">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                            <span className="text-[11px] font-bold text-white truncate">{name}</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] text-neutral-600 font-bold uppercase">Alerts</span>
                            <span className="text-[11px] font-bold text-emerald-400">{agentAlerts.length}</span>
                         </div>
                      </div>
                    );
                  })}
                </div>
              ) : data.agentProfile ? (
                 <div className="p-6 bg-black/40 border border-neutral-800 rounded-2xl space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center relative">
                             <div className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-4 border-black rounded-full" />
                             <Terminal className="w-7 h-7 text-neutral-700" />
                          </div>
                          <div>
                             <h4 className="text-base font-bold text-white truncate max-w-[150px]">{data.agentProfile.name}</h4>
                             <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{data.agentProfile.ip} • OS: {data.agentProfile.os_name || 'Linux'}</p>
                          </div>
                       </div>
                       <StatusPill status="Active" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                          <span className="text-[9px] font-bold text-neutral-600 uppercase block mb-1">Weekly Alerts</span>
                          <span className="text-xl font-bold text-white">{data.agentAlerts.length}</span>
                       </div>
                       <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                          <span className="text-[9px] font-bold text-neutral-600 uppercase block mb-1">Critical/High</span>
                          <span className="text-xl font-bold text-red-500">
                             {data.agentAlerts.filter((a: any) => a.severity === 'Critical' || a.severity === 'High').length}
                          </span>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block">Last Activity</span>
                       <div className="p-3 bg-black flex items-center gap-3 rounded-lg border border-neutral-800">
                          <Clock className="w-3.5 h-3.5 text-neutral-600" />
                          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Last keepalive {formatRelativeTime(data.agentProfile.last_keepalive)}</span>
                       </div>
                    </div>
                 </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-neutral-800 rounded-2xl">
                   <Database className="w-8 h-8 text-neutral-800" />
                   <p className="text-[11px] text-neutral-600 uppercase font-bold tracking-widest">Agent metadata unavailable</p>
                </div>
              )}

              {/* Last 5 Alerts list */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Recent Activity on Agent</h5>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                   {data.agentAlerts.slice(0, 5).map((alert: any, i: number) => (
                      <div key={i} className="p-3 bg-black/40 border border-neutral-800 rounded-xl flex items-center justify-between group hover:border-neutral-700 transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 group-hover:bg-emerald-400 transition-colors shrink-0" />
                          <p className="text-[10px] font-bold text-neutral-300 truncate">{alert.description}</p>
                        </div>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Notes, Evidence & Checklist */}
        <div className="w-1/3 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* Investigation Checklist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Investigation Checklist</h4>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">{completedCount} of 8 Completed</span>
              </div>

              <div className="space-y-2 bg-neutral-900/40 border border-neutral-800 p-4 rounded-2xl">
                 <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-4">
                    <motion.div 
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                    />
                 </div>
                 <div className="space-y-1">
                    {checklistItems.map((item) => (
                       <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-white/[0.03] rounded-lg transition-colors cursor-pointer group">
                          <div 
                            onClick={() => onChecklistUpdate(item.id, !workspace.checklist?.[item.id])}
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-all",
                              workspace.checklist?.[item.id] ? "bg-emerald-600 border-emerald-500" : "bg-black border-neutral-700 group-hover:border-neutral-500"
                            )}
                          >
                             {workspace.checklist?.[item.id] && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className={cn(
                            "text-[11px] font-medium transition-all duration-300",
                            workspace.checklist?.[item.id] ? "text-neutral-500 line-through" : "text-neutral-300 group-hover:text-white"
                          )}>
                             {item.label}
                          </span>
                       </label>
                    ))}
                 </div>
              </div>
            </div>

            {/* Evidence Locker Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Anchor className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Evidence Locker ({data.evidence.length})</h4>
                </div>
                <button 
                  onClick={() => setShowEvidenceModal(true)}
                  className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                 {data.evidence.map((ev: any, i: number) => (
                    <div key={i} className="p-4 border border-neutral-800 rounded-xl bg-black/40 hover:bg-black/60 transition-all group">
                       <div className="flex justify-between items-start mb-3">
                          <span className={cn(
                             "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border shadow-sm",
                             ev.evidence_type === 'alert' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                             ev.evidence_type === 'threat_intel' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                             ev.evidence_type === 'analyst_note' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                             'bg-neutral-800 text-neutral-400 border-neutral-700'
                          )}>{ev.evidence_type}</span>
                          <div className="flex items-center gap-2">
                             <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                ev.confidence === 'High' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" :
                                ev.confidence === 'Medium' ? "bg-yellow-500" : "bg-neutral-700"
                             )} />
                             <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">{ev.confidence} Confidence</span>
                          </div>
                       </div>
                       <h6 className="text-[12px] font-bold text-white mb-1 group-hover:text-blue-400 transition-colors leading-tight">{ev.title}</h6>
                       <p className="text-[10px] text-neutral-500 leading-relaxed mb-3">{ev.description}</p>
                       <div className="flex items-center justify-between pt-2 border-t border-neutral-800/50">
                          <span className="text-[8px] font-bold text-neutral-700 uppercase">{ev.added_by}</span>
                          <span className="text-[8px] text-neutral-800 font-mono">{new Date(ev.created_at).toLocaleDateString()}</span>
                       </div>
                    </div>
                 ))}
                 {data.evidence.length === 0 && (
                    <div className="py-12 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-center px-6">
                       <Database className="w-8 h-8 text-neutral-800 mb-2" />
                       <span className="text-[10px] text-neutral-700 font-bold uppercase tracking-[0.2em]">Secure Evidence Locker Empty</span>
                       <p className="text-[9px] text-neutral-700 mt-1 uppercase">Add critical findings here from any section</p>
                    </div>
                 )}
              </div>
            </div>

            {/* Investigation Notes Panel */}
            <div className="space-y-4 pb-12">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Investigation Notes ({data.notes.length})</h4>
              </div>

              <div className="space-y-4">
                 <div className="space-y-3">
                    {data.notes.map((note: any) => (
                       <div 
                         key={note.id} 
                         className={cn(
                           "p-5 border rounded-2xl transition-all relative overflow-hidden group",
                           note.is_key_finding ? 'border-yellow-500/40 bg-yellow-500/[0.03]' : 'border-neutral-800 bg-black/40'
                         )}
                       >
                          {note.is_key_finding && (
                             <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                                <Star className="w-12 h-12 text-yellow-400 fill-current" />
                             </div>
                          )}
                          <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center">
                                   <User className="w-3 h-3 text-neutral-500" />
                                </div>
                                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">{note.added_by}</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => onToggleKeyFinding(note.id, !note.is_key_finding)}
                                  className="p-1.5 hover:bg-yellow-500/10 rounded-lg transition-all"
                                  title={note.is_key_finding ? "Remove Key Finding" : "Mark as Key Finding"}
                                >
                                   <Star className={cn("w-3.5 h-3.5 transition-all", note.is_key_finding ? 'text-yellow-400 fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'text-neutral-700 hover:text-neutral-500')} />
                                </button>
                                <span className="text-[8px] text-neutral-700 font-mono">{formatRelativeTime(note.created_at)}</span>
                             </div>
                          </div>
                          <p className="text-[12px] text-neutral-300 leading-relaxed font-medium">{note.note}</p>
                          {note.is_key_finding && (
                             <div className="flex items-center gap-2 mt-4 pt-3 border-t border-yellow-500/10">
                                <div className="w-1 h-1 rounded-full bg-yellow-400" />
                                <span className="text-[8px] font-black text-yellow-400 uppercase tracking-[0.2em]">Validated Key Finding</span>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>

                 {/* Add Note Area */}
                 <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <textarea 
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type your observation here..."
                      className="w-full bg-transparent border-none focus:outline-none text-[12px] text-neutral-300 min-h-[100px] resize-none pb-4 leading-relaxed font-medium"
                    />
                    <div className="flex items-center justify-between pt-4 border-t border-neutral-800/50">
                       <label className="flex items-center gap-2.5 cursor-pointer group/key">
                          <div 
                            onClick={() => setIsKeyFinding(!isKeyFinding)}
                            className={cn(
                              "w-5 h-5 rounded-lg border flex items-center justify-center transition-all",
                              isKeyFinding ? "bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/20" : "bg-black border-neutral-800 group-hover/key:border-neutral-700"
                            )}
                          >
                             <Star className={cn("w-3 h-3 transition-all", isKeyFinding ? "text-yellow-400 fill-current" : "text-neutral-700")} />
                          </div>
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", isKeyFinding ? "text-yellow-400" : "text-neutral-600 hover:text-neutral-400 transition-colors")}>
                             Mark as Key Finding
                          </span>
                       </label>
                       <button 
                         onClick={() => {
                            if (!noteText.trim()) return;
                            onAddNote(noteText, isKeyFinding);
                            setNoteText('');
                            setIsKeyFinding(false);
                         }}
                         className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/10 active:scale-95"
                       >
                          Add Observation
                       </button>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Global Actions */}
      <div className="h-20 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 relative z-50">
         <div className="flex items-center gap-10">
            <div className="flex items-center gap-4 py-2 px-5 bg-black/40 border border-neutral-800 rounded-2xl">
               <div className="text-center px-4 border-r border-neutral-800">
                  <span className="block text-[8px] font-black text-neutral-700 uppercase tracking-widest mb-0.5">Alerts Found</span>
                  <span className="text-xl font-black text-white">{timelineAlerts.length}</span>
               </div>
               <div className="text-center px-4 border-r border-neutral-800">
                  <span className="block text-[8px] font-black text-neutral-700 uppercase tracking-widest mb-0.5">Notes Recorded</span>
                  <span className="text-xl font-black text-white">{data.notes.length}</span>
               </div>
               <div className="text-center px-4">
                  <span className="block text-[8px] font-black text-neutral-700 uppercase tracking-widest mb-0.5">Evidence Items</span>
                  <span className="text-xl font-black text-white">{data.evidence.length}</span>
               </div>
            </div>
            
            <button 
              onClick={() => onBlockIP(data.linkedAlert?.source_ip)}
              disabled={data.linkedAlert?.source_ip === 'N/A'}
              className="flex items-center gap-2.5 px-6 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-30 group"
            >
               <AlertTriangle className="w-4 h-4 group-hover:animate-shake" />
               🚫 Flag IP for Blocking
            </button>
         </div>

         <div className="flex items-center gap-4">
            <button 
              onClick={onAddCurrentFindingsAsEvidence}
              className="flex items-center gap-2.5 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.06] border border-neutral-800 text-neutral-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group"
            >
               <Target className="w-4 h-4 group-hover:scale-110 transition-transform" />
               📎 Capture Evidence Snapshot
            </button>
            <button 
              onClick={onGenerateReport}
              className="flex items-center gap-3 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-purple-600/20 group animate-pulse hover:animate-none"
            >
               <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
               📄 Generate AI Report from Findings
            </button>
            <button 
              onClick={onShowVerdict}
              className="px-10 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/30"
            >
               ✓ Final Verdict & Resolve
            </button>
         </div>
      </div>

      {/* Manual Evidence Modal */}
      <AnimatePresence>
        {showEvidenceModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10"
             >
                <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                         <Anchor className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                         <h3 className="text-lg font-black text-white uppercase tracking-widest">Capture Evidence</h3>
                         <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest mt-1">Ground your investigation in real data</p>
                      </div>
                   </div>
                   <button onClick={() => setShowEvidenceModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                      <X className="w-6 h-6 text-neutral-500" />
                   </button>
                </div>

                <div className="p-8 space-y-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Evidence Type</label>
                      <select 
                        value={evType}
                        onChange={(e) => setEvType(e.target.value)}
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                      >
                         <option value="alert">Alert Record</option>
                         <option value="threat_intel">Threat Intelligence Results</option>
                         <option value="analyst_observation">Analyst Observation</option>
                         <option value="external_source">External Source/Reference</option>
                         <option value="file">Suspicious File/Hash</option>
                         <option value="screenshot">Behavioral Screenshot</option>
                      </select>
                   </div>
                   
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Title</label>
                      <input 
                        type="text"
                        value={evTitle}
                        onChange={(e) => setEvTitle(e.target.value)}
                        placeholder="Key finding title..."
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                      />
                   </div>

                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Description</label>
                      <textarea 
                        value={evDesc}
                        onChange={(e) => setEvDesc(e.target.value)}
                        placeholder="Explain why this data is relevant to the case..."
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all h-32 resize-none"
                      />
                   </div>

                   <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest block mb-1">Confidence Assessment</label>
                      <div className="flex gap-4">
                         {['Low', 'Medium', 'High'].map((c) => (
                            <button 
                              key={c}
                              onClick={() => setEvConf(c)}
                              className={cn(
                                "flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all",
                                evConf === c ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20" : "bg-black text-neutral-600 border-neutral-800 hover:border-neutral-700"
                              )}
                            >
                               {c}
                            </button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="p-8 bg-black/40 border-t border-neutral-800 flex gap-4">
                   <button 
                     onClick={() => setShowEvidenceModal(false)}
                     className="flex-1 py-4 rounded-2xl text-[11px] font-black text-neutral-600 uppercase tracking-widest hover:bg-neutral-800 transition-all"
                   >
                      Cancel
                   </button>
                   <button 
                     disabled={!evTitle.trim()}
                     onClick={() => {
                        onAddEvidence(evType, evTitle, evDesc, evConf);
                        setShowEvidenceModal(false);
                        setEvTitle('');
                        setEvDesc('');
                     }}
                     className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all"
                   >
                      Log Evidence
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
