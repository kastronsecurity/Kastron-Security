import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Clock, 
  User, 
  Bot, 
  Send, 
  FileText, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Shield,
  ExternalLink,
  Loader2,
  X,
  Bell,
  MoreVertical,
  Check,
  Trash2,
  GitBranch,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Star,
  ArrowRight,
  PenTool,
  Download,
  Printer,
  Edit3,
  CheckCircle2,
  Share2,
  Info,
  Terminal,
  Layers,
  ShieldCheck,
  ArrowUpCircle,
  Anchor,
  MessageSquare,
  Save,
  Briefcase,
  Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import { LogViewer } from '../ui/LogViewer';
import { cn } from '../../lib/utils';
import { generateStructuredSOCReport, generateAINarrative } from '../../lib/gemini';
import { jsPDF } from "jspdf";
import { InvestigationWorkspace } from './InvestigationWorkspace';

// --- Types ---

interface Escalation {
  id: string;
  escalation_id: string;
  client_id: string;
  alert_id: string;
  report_id?: string;
  title: string;
  priority: string;
  status: string;
  severity: string;
  escalated_by: string;
  assigned_to?: string;
  escalation_notes?: string;
  investigation_notes?: string;
  resolution_type?: string;
  resolution_notes?: string;
  sla_deadline: string;
  sla_breached: boolean;
  client_notified: boolean;
  report_generated: boolean;
  escalated_at: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  agent_name?: string;
}

interface Activity {
  id: string;
  escalation_id: string;
  action: string;
  performed_by: string;
  details: string;
  created_at: string;
}

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  console.log(`[${type.toUpperCase()}] ${message}`);
};

// --- Components ---

const StatCard = ({ label, value, sub, color }: { label: string, value: string | number, sub: string, color?: string }) => (
  <div className="p-8 border-r border-neutral-800 last:border-r-0 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <h3 className="text-4xl font-bold text-white tracking-tighter">{value}</h3>
      <span className={cn("text-[11px] font-semibold tracking-tight", color || "text-neutral-400")}>
        {sub}
      </span>
    </div>
  </div>
);

const PriorityPill = ({ priority, label, count, colorClass }: { priority: string, label: string, count: number, colorClass: string }) => (
  <div className={cn("flex items-center gap-3 px-4 py-2 rounded-xl border", colorClass)}>
    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{priority}</span>
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    <div className="w-[1px] h-3 bg-current opacity-20" />
    <span className="text-[11px] font-bold">{count}</span>
  </div>
);

const AIAssistant = ({ escalation, onClose }: { escalation: Escalation, onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 w-[450px] h-full bg-black border-l border-neutral-800 z-[100] flex flex-col shadow-2xl"
    >
      <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Bot className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">AI Analyst Assistant</h3>
            <div className="flex gap-1.5 mt-1">
              {['Escalation Context', 'Alert Data', 'Investigation Notes', `Priority: ${escalation.priority}`].map(tag => (
                <span key={tag} className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest px-1.5 py-0.5 bg-white/5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center relative group">
          <div className="absolute inset-0 bg-red-500/5 blur-2xl rounded-full group-hover:bg-red-500/10 transition-all" />
          <Bot className="w-10 h-10 text-neutral-700 relative z-10" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white tracking-tight">AI Analysis on Standby</h3>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-[280px] mx-auto">
            The AI Assistant is currently disabled while we focus on Wazuh ingestion and timeline mapping.
          </p>
        </div>

        <div className="pt-8 flex flex-col gap-3 w-full max-w-[240px]">
          <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="h-full w-1/2 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"
            />
          </div>
          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-[0.2em]">System Maintenance</span>
        </div>
      </div>

      <div className="p-8 border-t border-neutral-800 bg-neutral-900/30">
        <button 
          onClick={onClose}
          className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all"
        >
          Return to Investigation
        </button>
      </div>
    </motion.div>
  );
};

const ResolveModal = ({ isOpen, onClose, onConfirm, escalation }: { isOpen: boolean, onClose: () => void, onConfirm: (type: string, notes: string, notify: boolean, report: boolean) => void, escalation: Escalation }) => {
  const [type, setType] = useState('True Positive — Threat Confirmed');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [report, setReport] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Resolve Escalation</h3>
              <p className="text-xs text-neutral-500">{escalation.escalation_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Resolution Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
            >
              <option>True Positive — Threat Confirmed</option>
              <option>False Positive — No Threat</option>
              <option>Benign — Expected Activity</option>
              <option>Duplicate — Already Handled</option>
              <option>Escalated to Client</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Resolution Notes</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide resolution details..."
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors h-24 resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                onClick={() => setReport(!report)}
                className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", report ? "bg-emerald-600 border-emerald-500" : "bg-black border-neutral-700")}
              >
                {report && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs text-neutral-300 group-hover:text-white transition-colors">Generate incident report</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                onClick={() => setNotify(!notify)}
                className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", notify ? "bg-emerald-600 border-emerald-500" : "bg-black border-neutral-700")}
              >
                {notify && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-xs text-neutral-300 group-hover:text-white transition-colors">Notify client</span>
            </label>
          </div>
        </div>

        <div className="p-6 bg-black/40 flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all">CANCEL</button>
          <button 
            onClick={() => onConfirm(type, notes, notify, report)}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
          >
            CONFIRM RESOLUTION
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AlertDetailsModal = ({ 
  isOpen, 
  onClose, 
  event 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  event: any;
}) => {
  const [viewMode, setViewMode] = useState<'raw' | 'table'>('table');

  if (!isOpen || !event) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      onMouseLeave={onClose}
      className="fixed top-6 right-[610px] z-[200] w-[450px] max-h-[calc(100vh-48px)] bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">Alert Details</h3>
              <SeverityBadge severity={event.severity} />
            </div>
            <p className="text-[9px] text-neutral-500 mt-0.5 font-mono">
              {event.alert_id.slice(0, 12)}...
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
          <X className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
        {/* Threat Detection Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Threat Detection</h4>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
            <h5 className="text-sm font-bold text-white mb-2 leading-tight">{event.rule_description}</h5>
            <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
              <p className="text-[11px] text-neutral-300 leading-relaxed italic">
                "{event.ai_explanation}"
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-2.5 bg-black/40 rounded-lg border border-neutral-800">
                <span className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest block mb-0.5">Phase</span>
                <span className="text-[10px] text-white font-bold uppercase">{event.kill_chain_phase}</span>
              </div>
              <div className="p-2.5 bg-black/40 rounded-lg border border-neutral-800">
                <span className="text-[7px] font-bold text-neutral-600 uppercase tracking-widest block mb-0.5">Agent</span>
                <span className="text-[10px] text-white font-bold truncate">{event.agent_name}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Log Viewer Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Event Logs</h4>
          </div>
          
          <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden">
            <LogViewer 
              data={event.raw_log} 
              viewMode={viewMode} 
              onViewModeChange={setViewMode}
            />
          </div>
        </section>
      </div>
    </motion.div>
  );
};

const AttackTimelinePanel = ({ 
  escalation, 
  onClose, 
  loading, 
  timeline, 
  events, 
  loadingStep,
  onGenerateReport,
  onNotifyClient,
  onSelectEvent
}: { 
  escalation: Escalation, 
  onClose: () => void, 
  loading: boolean, 
  timeline: any, 
  events: any[],
  loadingStep: number,
  onGenerateReport: (esc: Escalation) => void,
  onNotifyClient: (esc: Escalation) => void,
  onSelectEvent: (event: any) => void
}) => {
  const steps = [
    "Fetching related alerts...",
    "Mapping kill chain phases...",
    "Generating AI attack narrative...",
    "Finalizing timeline view..."
  ];

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Reconnaissance': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Initial Access': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Execution': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Persistence': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Privilege Escalation': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Defense Evasion': return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20';
      case 'Credential Access': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      case 'Lateral Movement': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      case 'Exfiltration': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-neutral-500 bg-neutral-500/10 border-neutral-500/20';
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 w-[600px] h-full bg-black border-l border-neutral-800 z-[100] flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <GitBranch className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              Attack Timeline
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] border border-purple-500/30">AI POWERED</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-1 font-medium truncate max-w-[300px]">
              {escalation.title}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <X className="w-5 h-5 text-neutral-500" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
              </div>
            </div>
            <div className="space-y-4 w-full max-w-xs">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500",
                    loadingStep > idx ? "bg-emerald-500" : loadingStep === idx ? "bg-purple-500 animate-pulse" : "bg-neutral-800"
                  )}>
                    {loadingStep > idx ? <Check className="w-3 h-3 text-white" /> : <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-widest transition-all duration-500",
                    loadingStep >= idx ? "text-white" : "text-neutral-600"
                  )}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {/* Top Static Content */}
            <div className="p-6 space-y-8 bg-black/20">
              {/* AI Narrative Section */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles className="w-20 h-20 text-purple-500" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">AI Attack Narrative</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] text-neutral-500 font-bold uppercase">Confidence</span>
                    <div className="w-12 h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${timeline?.confidence_score}%` }} />
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-neutral-300 leading-relaxed font-medium italic">
                  "{timeline?.ai_narrative}"
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-black/40 rounded-xl border border-neutral-800">
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block mb-1">Attack Type</span>
                    <span className="text-[11px] text-white font-bold">{timeline?.attack_type}</span>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-neutral-800">
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block mb-1">Risk Assessment</span>
                    <span className="text-[11px] text-red-500 font-bold uppercase tracking-widest">{timeline?.ai_result?.risk_assessment || 'High'}</span>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-black border border-neutral-800 rounded-2xl flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Total Events</span>
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-lg font-bold text-white">{timeline?.total_events}</span>
                  </div>
                </div>
                <div className="p-4 bg-black border border-neutral-800 rounded-2xl flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Duration</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-lg font-bold text-white">{timeline?.time_span_minutes}m</span>
                  </div>
                </div>
                <div className="p-4 bg-black border border-neutral-800 rounded-2xl flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Attacker IP</span>
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-lg font-bold text-white truncate">{timeline?.attacker_ip}</span>
                  </div>
                </div>
              </div>

              {/* Kill Chain Progress */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Kill Chain Progress</h5>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">Critical Stage: {timeline?.kill_chain_stage}</span>
                </div>
                <div className="flex gap-1.5">
                  {[
                    'Reconnaissance', 'Initial Access', 'Execution', 
                    'Persistence', 'Privilege Escalation', 'Defense Evasion', 
                    'Credential Access', 'Lateral Movement', 'Exfiltration'
                  ].map((phase, i) => {
                    const hasPhase = events.some(e => e.kill_chain_phase === phase);
                    const isPivot = events.some(e => e.kill_chain_phase === phase && e.is_pivot_point);
                    return (
                      <div 
                        key={phase} 
                        className={cn(
                          "flex-1 h-3 rounded-full border transition-all relative group",
                          hasPhase ? getPhaseColor(phase) : "bg-neutral-900 border-neutral-800"
                        )}
                      >
                        {isPivot && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
                            <Star className="w-1.5 h-1.5 text-white fill-current" />
                          </div>
                        )}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-[8px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          {phase}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Locked Event Sequence Header */}
              <div className="pt-8 flex items-center justify-between border-t border-neutral-800/50">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Event Sequence</h5>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Pivot Point</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Event Timeline */}
            <div className="p-6 scrollbar-hide">
              <div className="relative">
                <div className="absolute left-[11px] top-0 bottom-4 w-[1px] bg-neutral-800/50" />
                
                <div className="space-y-12">
                  {(() => {
                    const groupedEvents = events.reduce((acc: any[], event: any) => {
                      const lastGroup = acc[acc.length - 1];
                      if (lastGroup && lastGroup.phase === event.kill_chain_phase) {
                        lastGroup.events.push(event);
                      } else {
                        acc.push({
                          phase: event.kill_chain_phase,
                          events: [event]
                        });
                      }
                      return acc;
                    }, []);

                    return groupedEvents.map((group, gIdx) => (
                      <div key={gIdx} className="relative pl-10 space-y-4">
                        {/* Phase Marker */}
                        <div className={cn(
                          "absolute left-0 top-0 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center z-10 shadow-lg",
                          getPhaseColor(group.phase)
                        )}>
                          <div className="w-1.5 h-1.5 rounded-full bg-current" />
                        </div>

                        {/* Phase Header */}
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                            getPhaseColor(group.phase)
                          )}>
                            {group.phase}
                          </span>
                          <div className="h-[1px] flex-1 bg-neutral-800/50" />
                          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{group.events.length} {group.events.length === 1 ? 'Event' : 'Events'}</span>
                        </div>

                        {/* Events in this phase */}
                        <div className="grid grid-cols-1 gap-2">
                          {group.events.map((event: any) => (
                            <div 
                              key={event.id} 
                              onClick={() => onSelectEvent(event)}
                              className="group relative bg-neutral-900/20 border border-neutral-800/50 rounded-xl p-3 hover:bg-neutral-900/40 hover:border-neutral-700 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center gap-1.5 shrink-0 w-14">
                                  <span className="text-[9px] text-neutral-500 font-mono font-bold">
                                    {new Date(event.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <SeverityBadge severity={event.severity} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h6 className="text-[12px] font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                                      {event.rule_description}
                                    </h6>
                                    {event.is_pivot_point && (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-bold text-red-500 uppercase tracking-widest">
                                        <Zap className="w-2.5 h-2.5 fill-current" />
                                        PIVOT
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 line-clamp-1 group-hover:line-clamp-none transition-all">
                                    {event.ai_explanation}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-neutral-800/50">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[8px] font-bold text-neutral-700 uppercase tracking-widest">Source IP</span>
                                    <span className="text-[10px] text-neutral-500 font-mono">{event.source_ip}</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-[8px] font-bold text-neutral-700 uppercase tracking-widest">Agent</span>
                                    <span className="text-[10px] text-neutral-500 font-mono">{event.agent_name}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {!loading && (
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/50 grid grid-cols-2 gap-4">
          <button 
            onClick={() => {
              console.log('Generate Report clicked in Timeline');
              onGenerateReport(escalation);
            }}
            className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-neutral-800 rounded-xl text-[11px] font-bold text-neutral-400 uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all"
          >
            <FileText className="w-4 h-4" />
            GENERATE REPORT
          </button>
          <button 
            onClick={() => {
              console.log('Notify Client clicked in Timeline');
              onNotifyClient(escalation);
            }}
            className="flex items-center justify-center gap-2 py-3 bg-purple-500 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/20"
          >
            <Mail className="w-4 h-4" />
            NOTIFY CLIENT
          </button>
        </div>
      )}
    </motion.div>
  );
};

const ReportOptionModal = ({ isOpen, onClose, onSelect, escalation }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (mode: 'ai' | 'manual') => void,
  escalation: Escalation 
}) => {
  if (!isOpen || !escalation) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Generate Report</h3>
              <p className="text-xs text-neutral-500">{escalation.escalation_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">Choose how you would like to generate the incident report for this escalation.</p>
          
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => onSelect('ai')}
              className="flex items-center gap-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl hover:bg-purple-500/10 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Generate with AI</span>
                <span className="text-[11px] text-neutral-500">AI will analyze the attack and write a detailed report.</span>
              </div>
            </button>

            <button 
              onClick={() => onSelect('manual')}
              className="flex items-center gap-4 p-4 bg-white/[0.02] border border-neutral-800 rounded-xl hover:bg-white/[0.05] transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <PenTool className="w-5 h-5 text-neutral-400" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Write Manually</span>
                <span className="text-[11px] text-neutral-500">Start with a blank template and write it yourself.</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 bg-black/40">
          <button onClick={onClose} className="w-full py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all">CANCEL</button>
        </div>
      </motion.div>
    </div>
  );
};

const ReportViewerPanel = ({ 
  escalation, 
  onClose, 
  reportContent,
  reportTitle,
  onSave,
  isSaving,
  isGenerating
}: { 
  escalation: Escalation, 
  onClose: () => void, 
  reportContent: any,
  reportTitle: string,
  onSave: (title: string, content: any) => void,
  isSaving: boolean,
  isGenerating: boolean
}) => {
  const { currentClient } = useClient();
  const { addNotification } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(reportTitle || 'INCIDENT REPORT');
  const [editContent, setEditContent] = useState<any>(null);

  useEffect(() => {
    if (reportContent) {
      try {
        const parsed = typeof reportContent === 'string' ? JSON.parse(reportContent) : reportContent;
        setEditContent(parsed);
        setEditTitle(reportTitle || 'INCIDENT REPORT');
      } catch (e) {
        // Fallback for old markdown reports
        setEditContent({ executive_summary: reportContent });
        setEditTitle(reportTitle || 'INCIDENT REPORT');
      }
    }
  }, [reportContent, reportTitle]);

  const handleExportPDF = () => {
    if (!editContent) {
      showToast('Report content not found', 'error');
      return;
    }
    
    showToast('Generating PDF...', 'info');

    const title = editTitle;
    const clientName = currentClient?.name || 'N/A';
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reportType = 'INCIDENT REPORT';
    const reportSub = 'Incident Analysis & Remediation';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      color: #171717;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4;
      margin: 16mm 16mm 18mm 16mm;
    }

    .page {
      width: 100%;
      min-height: 257mm;
      max-height: 257mm;
      overflow: hidden;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
    }

    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .section-block {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 24px;
    }

    /* Typography */
    .section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #dc2626; padding-bottom: 8px; }
    .section-num { font-size: 20px; font-weight: 900; color: #dc2626; }
    .section-title { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #171717; letter-spacing: 0.05em; margin: 0; }
    .body-text { font-size: 12px; line-height: 1.55; color: #404040; margin: 0 0 12px 0; }
    .sub-title { font-size: 10px; font-weight: 700; color: #737373; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0; }
    
    /* Header/Footer */
    .footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .footer-left { color: #a3a3a3; }
    .footer-right { color: #dc2626; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f5f5f5;
    }
    .header-logo { font-size: 18px; font-weight: 900; letter-spacing: -0.05em; }
    .header-logo span { color: #dc2626; }
    .header-meta { font-size: 8px; font-weight: 700; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    th { background: #171717; color: white; padding: 8px 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #404040; }
    tr:last-child td { border-bottom: none; }
    .td-label { font-weight: 700; color: #737373; width: 30%; border-right: 1px solid #e5e5e5; background: #f9fafb; text-transform: uppercase; letter-spacing: 0.05em; }
    .td-value { font-weight: 700; color: #2563eb; white-space: pre-wrap; word-break: break-word; vertical-align: top; }
    .td-value-red { font-weight: 700; color: #dc2626; text-transform: uppercase; }

    /* Cover */
    .cover-block { display: flex; margin-bottom: 40px; }
    .cover-left { flex: 1; background: #1a1f2c; padding: 48px; }
    .cover-right { width: 33%; background: #c23e2b; padding: 48px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; text-align: right; }
    .cover-title { font-size: 32px; font-weight: 900; color: #171717; margin: 0 0 8px 0; letter-spacing: -0.02em; }
    .cover-subtitle { font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 40px 0; }
    
    /* Highlight Box */
    .highlight-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .highlight-box p { margin: 0; color: #991b1b; font-style: italic; font-size: 12px; line-height: 1.55; }
  </style>
</head>
<body>
  <div id="pages-container">
    <div class="page">
      <div class="header" style="border: none; margin-bottom: 40px;">
        <div class="header-logo">KASTRON<span>SEC</span></div>
        <div class="header-meta">${reportType} | CONFIDENTIAL</div>
      </div>
      <div class="page-content">
        <div class="cover-block">
          <div class="cover-left">
            <div style="font-size: 48px; font-weight: 900; color: white; line-height: 1; letter-spacing: -0.05em;">KASTRON</div>
            <div style="font-size: 48px; font-weight: 900; color: #dc2626; line-height: 1; margin-bottom: 24px; letter-spacing: -0.05em;">SEC</div>
            <div style="color: #a3a3a3; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; font-size: 10px;">Security Operations Center</div>
          </div>
          <div class="cover-right">
            <div style="color: white; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; margin-bottom: 4px;">${reportType}</div>
            <div style="color: rgba(255,255,255,0.6); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 8px;">CONFIDENTIAL</div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 40px;">
          <h2 class="cover-title">Security Incident Report</h2>
          <h3 class="cover-subtitle">${reportSub}</h3>
          <div style="width: 100%; max-width: 500px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
            <table style="margin: 0; border: none;">
              <tbody style="border: none;">
                <tr style="background: #f9fafb;"><td class="td-label" style="width: 40%;">Client Name</td><td class="td-value">${clientName}</td></tr>
                <tr><td class="td-label">Report Title</td><td class="td-value">${title}</td></tr>
                <tr style="background: #f9fafb;"><td class="td-label">Generated Date</td><td class="td-value">${date}</td></tr>
                <tr><td class="td-label">Classification</td><td class="td-value">CONFIDENTIAL</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-left">KASTRONSEC — SECURITY OPERATIONS CENTER</div>
        <div class="footer-right">CONFIDENTIAL</div>
      </div>
    </div>
  </div>
  <script>
    const content = ${JSON.stringify(editContent)};
    const container = document.getElementById('pages-container');
    
    function createPage() {
      const page = document.createElement('div');
      page.className = 'page';
      const header = document.createElement('div');
      header.className = 'header';
      header.innerHTML = '<div class="header-logo">KASTRON<span>SEC</span></div><div class="header-meta">${title} | ${date}</div>';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'page-content';
      const footer = document.createElement('div');
      footer.className = 'footer';
      footer.innerHTML = '<div class="footer-left">KASTRONSEC — SECURITY OPERATIONS CENTER</div><div class="footer-right">CONFIDENTIAL</div>';
      page.appendChild(header);
      page.appendChild(contentDiv);
      page.appendChild(footer);
      container.appendChild(page);
      return contentDiv;
    }

    let currentPage = createPage();

    function addSection(num, title, html) {
      const sec = document.createElement('div');
      sec.className = 'section-block';
      sec.innerHTML = \`
        <div class="section-header">
          <span class="section-num">\${num}</span>
          <h2 class="section-title">\${title}</h2>
        </div>
        \${html}
      \`;
      currentPage.appendChild(sec);
      if (currentPage.scrollHeight > currentPage.clientHeight) {
        currentPage.removeChild(sec);
        currentPage = createPage();
        currentPage.appendChild(sec);
      }
    }

    // 01 Executive Summary
    addSection('01', 'Executive Summary', \`<div class="highlight-box"><p>\${content.executive_summary || 'N/A'}</p></div>\`);

    // 02 Incident Details
    const details = content.incident_details || {};
    addSection('02', 'Incident Details', \`
      <table>
        <tbody>
          <tr><td class="td-label">Alert ID</td><td class="td-value">\${details.alert_id || 'N/A'}</td></tr>
          <tr><td class="td-label">Severity</td><td class="td-value-red">\${details.severity || 'N/A'}</td></tr>
          <tr><td class="td-label">Timestamp</td><td class="td-value">\${details.timestamp || 'N/A'}</td></tr>
          <tr><td class="td-label">Agent</td><td class="td-value">\${details.agent || 'N/A'}</td></tr>
          <tr><td class="td-label">Source IP</td><td class="td-value">\${details.source_ip || 'N/A'}</td></tr>
        </tbody>
      </table>
    \`);

    // 03 Attack Analysis
    const attack = content.attack_analysis || {};
    addSection('03', 'Attack Analysis', \`
      <div class="body-text"><strong>Attack Type:</strong> \${attack.attack_type || 'Malicious Activity'}</div>
      <div class="sub-title">Technical Description</div>
      <div class="body-text">\${attack.description || 'N/A'}</div>
      <div class="sub-title">Attack Chain</div>
      <div class="body-text">\${Array.isArray(attack.attack_chain) ? attack.attack_chain.join(' → ') : (attack.attack_chain || 'None')}</div>
      <div class="sub-title">MITRE ATT&CK Techniques</div>
      <div class="body-text">\${Array.isArray(attack.mitre_techniques) ? attack.mitre_techniques.join(', ') : (attack.mitre_techniques || 'N/A')}</div>
    \`);

    // 04 IOC ANALYSIS & THREAT INTELLIGENCE
    const iocs = content.ioc_analysis || [];
    addSection('04', 'IOC Analysis & Threat Intelligence', \`
      <table>
        <thead>
          <tr>
            <th style="font-size: 8px;">IOC Type</th>
            <th style="font-size: 8px;">Value</th>
            <th style="font-size: 8px;">Verdict</th>
            <th style="font-size: 8px;">Threat Score</th>
            <th style="font-size: 8px;">Source</th>
          </tr>
        </thead>
        <tbody>
          \${Array.isArray(iocs) && iocs.length > 0 ? iocs.map(ioc => \`
            <tr>
              <td style="font-size: 9px;">\${ioc.type || 'N/A'}</td>
              <td style="font-size: 9px; word-break: break-all;">\${ioc.value || 'N/A'}</td>
              <td style="font-size: 9px;">\${ioc.verdict || 'N/A'}</td>
              <td style="font-size: 9px;">\${ioc.threat_score || 'N/A'}</td>
              <td style="font-size: 9px;">\${ioc.source || 'N/A'}</td>
            </tr>
          \`).join('') : '<tr><td colspan="5" style="text-align: center; font-size: 9px;">No IOCs identified</td></tr>'}
        </tbody>
      </table>
    \`);

    // 05 IMPACT ASSESSMENT
    const impact = content.impact_assessment || {};
    addSection('05', 'Impact Assessment', \`
      <table>
        <tbody>
          <tr><td class="td-label">Affected Systems</td><td class="td-value">\${impact.affected_systems || 'None'}</td></tr>
          <tr><td class="td-label">Data at Risk</td><td class="td-value">\${impact.data_at_risk || 'N/A'}</td></tr>
          <tr><td class="td-label">Business Impact</td><td class="td-value">\${impact.business_impact || 'N/A'}</td></tr>
          <tr><td class="td-label">Containment Status</td><td class="td-value">\${impact.containment_status || 'N/A'}</td></tr>
          <tr><td class="td-label">True Positive</td><td class="td-value">\${impact.true_positive || 'N/A'}</td></tr>
          <tr><td class="td-label">Confidence Level</td><td class="td-value">\${impact.confidence_level || 'N/A'}</td></tr>
        </tbody>
      </table>
    \`);

    // 06 RECOMMENDATIONS
    const recs = content.recommendations || {};
    addSection('06', 'Recommendations', \`
      <div class="sub-title">Immediate Actions (P0 — DO NOW)</div>
      <div class="body-text">\${Array.isArray(recs.immediate) ? recs.immediate.join('<br>') : (recs.immediate || 'None')}</div>
      <div class="sub-title">Short-Term Actions (24—48 Hours)</div>
      <div class="body-text">\${Array.isArray(recs.short_term) ? recs.short_term.join('<br>') : (recs.short_term || 'None')}</div>
      <div class="sub-title">Long-Term / Strategic</div>
      <div class="body-text">\${Array.isArray(recs.long_term) ? recs.long_term.join('<br>') : (recs.long_term || 'None')}</div>
    \`);

    // 07 ANALYST NOTES
    addSection('07', 'Analyst Notes', \`<div class="highlight-box" style="background: #f8fafc; border-color: #e2e8f0;"><p style="color: #475569;">\${content.analyst_notes || 'No additional analyst notes provided.'}</p></div>\`);

    // 08 CONCLUSION
    addSection('08', 'Conclusion', \`<div class="highlight-box" style="background: #f0fdf4; border-color: #dcfce7;"><p style="color: #166534;">\${content.conclusion || 'N/A'}</p></div>\`);

    window.onload = () => { setTimeout(() => { window.print(); }, 1000); };
  </script>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      addNotification({
        type: 'report_downloaded',
        title: 'Report Exported',
        description: `The incident report for ${escalation.escalation_id} has been exported to PDF.`,
        alertId: escalation.alert_id
      });
    } else {
      showToast('Please allow popups to generate PDF', 'error');
    }
  };

  if (!escalation) return null;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed top-0 right-0 w-[800px] h-full bg-neutral-950 border-l border-neutral-800 z-[100] flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <FileText className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            {isEditing ? (
              <input 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-transparent border-none text-lg font-bold text-white focus:outline-none p-0 w-full"
              />
            ) : (
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                {editTitle}
                {isGenerating && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] border border-purple-500/30 animate-pulse">AI GENERATING...</span>}
              </h3>
            )}
            <p className="text-[11px] text-neutral-500 mt-1 font-medium truncate max-w-[400px]">
              Professional Incident Report Viewer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <button 
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
            >
              <Check className="w-3.5 h-3.5" /> Done Editing
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-lg border border-neutral-800 transition-all uppercase tracking-widest"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Report
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Content Area - Professional PDF-like View */}
      <div className="flex-1 overflow-y-auto bg-neutral-900 p-8 scrollbar-hide">
        {isGenerating ? (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse" />
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin relative" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="text-sm font-bold text-white uppercase tracking-widest">AI is writing the report</h4>
              <p className="text-xs text-neutral-500">Analyzing kill chain, logs, and mitigation steps...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-[700px] mx-auto space-y-8">
            {/* Cover Page Representation */}
            <div className="bg-white p-12 min-h-[900px] shadow-2xl flex flex-col justify-between relative overflow-hidden rounded-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1">
                  <span className="text-xl font-black tracking-tighter text-neutral-900">KASTRON</span>
                  <span className="text-xl font-black tracking-tighter text-red-600">SEC</span>
                </div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                  INCIDENT REPORT | CONFIDENTIAL
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-full flex mb-12 shadow-xl">
                  <div className="flex-1 bg-[#1a1f2c] p-10 text-left">
                    <h1 className="text-4xl font-black text-white mb-1 tracking-tighter">KASTRON</h1>
                    <h1 className="text-4xl font-black text-red-600 mb-4 tracking-tighter">SEC</h1>
                    <p className="text-neutral-400 font-bold uppercase tracking-[0.3em] text-[9px]">Security Operations Center</p>
                  </div>
                  <div className="w-1/3 bg-[#c23e2b] p-10 flex flex-col justify-center items-end text-right">
                    <p className="text-white font-black uppercase tracking-widest text-[10px] mb-1">INCIDENT REPORT</p>
                    <p className="text-white/60 font-bold uppercase tracking-widest text-[7px]">CONFIDENTIAL</p>
                  </div>
                </div>

                <h2 className="text-3xl font-black text-neutral-900 mb-2 tracking-tight">Security Incident Report</h2>
                <h3 className="text-sm font-bold text-red-600 uppercase tracking-[0.2em] mb-16">Incident Analysis & Remediation</h3>

                <div className="w-full border border-neutral-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[10px]">
                    <tbody className="divide-y divide-neutral-200">
                      <tr className="bg-neutral-50">
                        <td className="px-6 py-3 font-bold text-neutral-500 w-1/3 border-r border-neutral-200 uppercase tracking-wider">Client Name</td>
                        <td className="px-6 py-3 font-bold text-blue-600">{currentClient?.name || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-3 font-bold text-neutral-500 border-r border-neutral-200 uppercase tracking-wider">Report Title</td>
                        <td className="px-6 py-3 font-bold text-blue-600">{editTitle}</td>
                      </tr>
                      <tr className="bg-neutral-50">
                        <td className="px-6 py-3 font-bold text-neutral-500 border-r border-neutral-200 uppercase tracking-wider">Generated Date</td>
                        <td className="px-6 py-3 font-bold text-blue-600">{new Date().toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-3 font-bold text-neutral-500 border-r border-neutral-200 uppercase tracking-wider">Classification</td>
                        <td className="px-6 py-3 font-bold text-blue-600">CONFIDENTIAL</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-6 border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                <span>KastronSec — Security Operations Center</span>
                <span className="text-red-600">CONFIDENTIAL</span>
              </div>
            </div>

            {/* Content Page Representation */}
            <div className="bg-white p-12 min-h-[900px] shadow-2xl flex flex-col rounded-sm">
              <div className="flex justify-between items-start mb-10 border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black tracking-tighter text-neutral-900">KASTRON</span>
                  <span className="text-lg font-black tracking-tighter text-red-600">SEC</span>
                </div>
                <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                  {editTitle} | {new Date().toLocaleDateString()}
                </div>
              </div>

              <div className="space-y-10 flex-grow">
                {/* 01 EXECUTIVE SUMMARY */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">01</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Executive Summary</h2>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                    {isEditing ? (
                      <textarea 
                        value={editContent?.executive_summary || ""} 
                        onChange={(e) => setEditContent({ ...editContent, executive_summary: e.target.value })}
                        className="w-full bg-white border border-red-200 rounded-lg p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px]"
                      />
                    ) : (
                      <p className="text-xs text-red-900 leading-relaxed italic break-words whitespace-pre-wrap">
                        {editContent?.executive_summary || "No summary available."}
                      </p>
                    )}
                  </div>
                </section>

                {/* 02 INCIDENT DETAILS */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">02</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Incident Details</h2>
                  </div>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <tbody className="divide-y divide-neutral-200">
                        {[
                          { key: 'alert_id', label: 'Alert ID', value: editContent?.incident_details?.alert_id || 'N/A' },
                          { key: 'severity', label: 'Severity', value: editContent?.incident_details?.severity || 'N/A', isRed: true },
                          { key: 'timestamp', label: 'Event Timestamp', value: editContent?.incident_details?.timestamp || 'N/A' },
                          { key: 'agent', label: 'Agent Name', value: editContent?.incident_details?.agent || 'N/A' },
                          { key: 'source_ip', label: 'Source IP', value: editContent?.incident_details?.source_ip || 'N/A' },
                          { key: 'dest_ip', label: 'Destination IP', value: editContent?.incident_details?.dest_ip || 'N/A' }
                        ].map((item, i) => (
                          <tr key={item.label} className={i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                            <td className="px-4 py-2 font-bold text-neutral-500 w-1/3 border-r border-neutral-200 uppercase tracking-widest text-[8px]">{item.label}</td>
                            <td className={cn("px-4 py-2 font-bold", item.isRed ? "text-red-600" : "text-blue-600")}>
                              {isEditing ? (
                                <input 
                                  value={item.value}
                                  onChange={(e) => {
                                    const newContent = { ...editContent };
                                    if (!newContent.incident_details) newContent.incident_details = {};
                                    newContent.incident_details[item.key] = e.target.value;
                                    setEditContent(newContent);
                                  }}
                                  className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold"
                                />
                              ) : item.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 03 ATTACK ANALYSIS */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">03</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Attack Analysis</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Attack Type:</span>
                      {isEditing ? (
                        <input 
                          value={editContent?.attack_analysis?.attack_type || "Malicious Activity"}
                          onChange={(e) => setEditContent({
                            ...editContent,
                            attack_analysis: { ...editContent.attack_analysis, attack_type: e.target.value }
                          })}
                          className="bg-transparent border-b border-neutral-200 text-xs font-bold text-red-600 focus:outline-none"
                        />
                      ) : (
                        <span className="text-xs font-bold text-red-600 uppercase">{editContent?.attack_analysis?.attack_type || "Malicious Activity"}</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Technical Description</h4>
                      {isEditing ? (
                        <textarea 
                          value={editContent?.attack_analysis?.description || ""} 
                          onChange={(e) => setEditContent({ 
                            ...editContent, 
                            attack_analysis: { ...editContent.attack_analysis, description: e.target.value } 
                          })}
                          className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        />
                      ) : (
                        <p className="text-xs text-neutral-700 leading-relaxed break-words whitespace-pre-wrap">
                          {editContent?.attack_analysis?.description || "No analysis provided."}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Attack Chain</h4>
                      {isEditing ? (
                        <input 
                          value={Array.isArray(editContent?.attack_analysis?.attack_chain) ? editContent.attack_analysis.attack_chain.join(' → ') : (editContent?.attack_analysis?.attack_chain || "")}
                          onChange={(e) => setEditContent({
                            ...editContent,
                            attack_analysis: { ...editContent.attack_analysis, attack_chain: e.target.value.split(' → ') }
                          })}
                          className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Initial Access → Persistence → ..."
                        />
                      ) : (
                        <p className="text-xs text-neutral-700 font-medium">{Array.isArray(editContent?.attack_analysis?.attack_chain) ? editContent.attack_analysis.attack_chain.join(' → ') : (editContent?.attack_analysis?.attack_chain || "None")}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">MITRE ATT&CK Techniques</h4>
                      {isEditing ? (
                        <input 
                          value={Array.isArray(editContent?.attack_analysis?.mitre_techniques) ? editContent.attack_analysis.mitre_techniques.join(', ') : (editContent?.attack_analysis?.mitre_techniques || "")}
                          onChange={(e) => setEditContent({
                            ...editContent,
                            attack_analysis: { ...editContent.attack_analysis, mitre_techniques: e.target.value.split(',').map(t => t.trim()).filter(t => t !== "") }
                          })}
                          className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="T1566, T1059..."
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(editContent?.attack_analysis?.mitre_techniques) ? (
                            editContent.attack_analysis.mitre_techniques.map((t: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-neutral-100 border border-neutral-200 rounded text-[9px] font-bold text-neutral-600 uppercase">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-neutral-400 italic">None specified</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 04 IOC ANALYSIS & THREAT INTELLIGENCE */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">04</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">IOC Analysis & Threat Intelligence</h2>
                  </div>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[9px]">
                      <thead className="bg-neutral-900 text-white uppercase tracking-widest">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Value</th>
                          <th className="px-3 py-2">Verdict</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {Array.isArray(editContent?.ioc_analysis) && editContent.ioc_analysis.length > 0 ? (
                          editContent.ioc_analysis.map((ioc: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                              <td className="px-3 py-2 font-bold text-neutral-500">{ioc.type}</td>
                              <td className="px-3 py-2 font-mono text-blue-600 break-all">{ioc.value}</td>
                              <td className="px-3 py-2 font-bold text-red-600">{ioc.verdict}</td>
                              <td className="px-3 py-2 font-bold">{ioc.threat_score}</td>
                              <td className="px-3 py-2 text-neutral-400">{ioc.source}</td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-400 italic">No IOCs identified</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 05 IMPACT ASSESSMENT */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">05</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Impact Assessment</h2>
                  </div>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <tbody className="divide-y divide-neutral-200">
                        {[
                          { key: 'affected_systems', label: 'Affected Systems', value: editContent?.impact_assessment?.affected_systems || 'None' },
                          { key: 'data_at_risk', label: 'Data at Risk', value: editContent?.impact_assessment?.data_at_risk || 'N/A' },
                          { key: 'business_impact', label: 'Business Impact', value: editContent?.impact_assessment?.business_impact || 'N/A' },
                          { key: 'containment_status', label: 'Containment Status', value: editContent?.impact_assessment?.containment_status || 'N/A' },
                          { key: 'true_positive', label: 'True Positive', value: editContent?.impact_assessment?.true_positive || 'N/A' },
                          { key: 'confidence_level', label: 'Confidence Level', value: editContent?.impact_assessment?.confidence_level || 'N/A' }
                        ].map((item, i) => (
                          <tr key={item.label} className={i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                            <td className="px-4 py-2 font-bold text-neutral-500 w-1/3 border-r border-neutral-200 uppercase tracking-widest text-[8px]">{item.label}</td>
                            <td className="px-4 py-2 font-bold text-neutral-700">
                              {isEditing ? (
                                <input 
                                  value={item.value}
                                  onChange={(e) => {
                                    const newContent = { ...editContent };
                                    if (!newContent.impact_assessment) newContent.impact_assessment = {};
                                    newContent.impact_assessment[item.key] = e.target.value;
                                    setEditContent(newContent);
                                  }}
                                  className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold"
                                />
                              ) : item.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 06 RECOMMENDATIONS */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">06</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Recommendations</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { key: 'immediate', label: 'Immediate Actions (P0 — DO NOW)', color: 'red' },
                      { key: 'short_term', label: 'Short-Term Actions (24—48 Hours)', color: 'orange' },
                      { key: 'long_term', label: 'Long-Term / Strategic', color: 'blue' }
                    ].map(section => (
                      <div key={section.key} className="space-y-2">
                        <h4 className={`text-[9px] font-bold text-${section.color}-600 uppercase tracking-widest`}>{section.label}</h4>
                        <div className={`p-3 bg-${section.color}-50/50 border border-${section.color}-100 rounded-lg`}>
                          {isEditing ? (
                            <textarea 
                              value={Array.isArray(editContent?.recommendations?.[section.key]) ? editContent.recommendations[section.key].join('\n') : (editContent?.recommendations?.[section.key] || "")}
                              onChange={(e) => {
                                const newContent = { ...editContent };
                                if (!newContent.recommendations) newContent.recommendations = {};
                                newContent.recommendations[section.key] = e.target.value.split('\n');
                                setEditContent(newContent);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-lg p-2 text-xs text-neutral-900 focus:outline-none min-h-[60px]"
                            />
                          ) : (
                            <ul className="list-disc list-inside space-y-1">
                              {Array.isArray(editContent?.recommendations?.[section.key]) ? (
                                editContent.recommendations[section.key].map((r: string, i: number) => (
                                  <li key={i} className="text-xs text-neutral-700">{r}</li>
                                ))
                              ) : (
                                <li className="text-xs text-neutral-400 italic">None specified</li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 07 ANALYST NOTES */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">07</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Analyst Notes</h2>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    {isEditing ? (
                      <textarea 
                        value={editContent?.analyst_notes || ""} 
                        onChange={(e) => setEditContent({ ...editContent, analyst_notes: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-500 min-h-[100px]"
                      />
                    ) : (
                      <p className="text-xs text-neutral-600 leading-relaxed italic break-words whitespace-pre-wrap">
                        {editContent?.analyst_notes || "No additional analyst notes provided."}
                      </p>
                    )}
                  </div>
                </section>

                {/* 08 CONCLUSION */}
                <section className="space-y-4">
                  <div className="flex items-baseline gap-4 border-b-2 border-red-600 pb-2">
                    <span className="text-xl font-black text-red-600">08</span>
                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">Conclusion</h2>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    {isEditing ? (
                      <textarea 
                        value={editContent?.conclusion || ""} 
                        onChange={(e) => setEditContent({ ...editContent, conclusion: e.target.value })}
                        className="w-full bg-white border border-green-200 rounded-lg p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[100px]"
                      />
                    ) : (
                      <p className="text-xs text-green-900 leading-relaxed font-medium break-words whitespace-pre-wrap">
                        {editContent?.conclusion || "No conclusion provided."}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <div className="pt-8 mt-auto border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                <span>KastronSec — Security Operations Center</span>
                <span className="text-red-600">CONFIDENTIAL</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-neutral-800 bg-black flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-neutral-200 text-black text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest"
          >
            <Printer className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button 
            className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-xl border border-neutral-800 transition-all uppercase tracking-widest"
          >
            <Mail className="w-3.5 h-3.5" /> Email Client
          </button>
        </div>
        <button 
          onClick={() => onSave(editTitle, editContent)}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-blue-600/20"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Report
        </button>
      </div>
    </motion.div>
  );
};

const NotifyModal = ({ isOpen, onClose, onConfirm, escalation }: { isOpen: boolean, onClose: () => void, onConfirm: (msg: string) => void, escalation: Escalation }) => {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (escalation) {
      setMsg(`Hello, we are investigating escalation ${escalation.escalation_id}: ${escalation.title}. We will provide updates as they become available.`);
    }
  }, [escalation]);

  if (!isOpen || !escalation) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Notify Client</h3>
              <p className="text-xs text-neutral-500">{escalation.escalation_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Message</label>
            <textarea 
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors h-32 resize-none"
            />
          </div>
        </div>

        <div className="p-6 bg-black/40 flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all">CANCEL</button>
          <button 
            onClick={() => onConfirm(msg)}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
          >
            SEND NOTIFICATION
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const LinkedAlertsModal = ({ isOpen, onClose, escalation }: { isOpen: boolean, onClose: () => void, escalation: Escalation }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentClient } = useClient();

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!isOpen || !escalation || !currentClient) return;
      setLoading(true);
      try {
        // Get the main alert
        const { data: mainAlert } = await supabase
          .from('alerts')
          .select('*')
          .eq('id', escalation.alert_id)
          .single();

        if (!mainAlert) {
          setAlerts([]);
          return;
        }

        // Find related alerts by IP or Agent
        const { data: related } = await supabase
          .from('alerts')
          .select('*')
          .eq('client_id', currentClient.id)
          .or(`source_ip.eq.${mainAlert.source_ip},agent_name.eq.${mainAlert.agent_name}`)
          .order('timestamp', { ascending: false })
          .limit(20);

        setAlerts(related || []);
      } catch (error) {
        console.error("Error fetching linked alerts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [isOpen, escalation, currentClient]);

  if (!isOpen || !escalation) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Linked Alerts</h3>
              <p className="text-xs text-neutral-500">Related to {escalation.escalation_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Fetching linked alerts...</p>
            </div>
          ) : alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-4 bg-black/40 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-all group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-[10px] text-neutral-500 font-mono">{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{alert.agent_name}</span>
                  </div>
                  <h4 className="text-[12px] font-bold text-white group-hover:text-blue-400 transition-colors">{alert.rule_description}</h4>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Source IP</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{alert.source_ip}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Event ID</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{alert.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-neutral-500 italic text-sm">No linked alerts found.</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-black/40 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-neutral-800 hover:bg-neutral-700 transition-all">CLOSE</button>
        </div>
      </motion.div>
    </div>
  );
};

export default function EscalationsPage() {
  const { currentClient, user } = useClient();
  const { settings, addNotification } = useNotifications();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [activeWorkspaces, setActiveWorkspaces] = useState<Record<string, string>>({});
  
  // Workspace State
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [activeWorkspaceEsc, setActiveWorkspaceEsc] = useState<any>(null);
  const [workspaceData, setWorkspaceData] = useState<any>({
    linkedAlert: null,
    notes: [],
    evidence: [],
    threatIntel: [],
    agentAlerts: [],
    relatedAlerts: [],
    timelineAlerts: [],
    ipHistory: [],
    agentProfile: null,
    correlatedData: { groups: [], alerts: [] },
    similarCases: []
  });
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [threatIntelLoading, setThreatIntelLoading] = useState(false);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [selectedVerdictId, setSelectedVerdictId] = useState<string | null>(null);
  const [verdictReason, setVerdictReason] = useState('');
  const [verdictConfidence, setVerdictConfidence] = useState(90);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [slaOnly, setSlaOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [aiEscalation, setAiEscalation] = useState<Escalation | null>(null);
  const [resolveModalEsc, setResolveModalEsc] = useState<Escalation | null>(null);
  const [notifyModalEsc, setNotifyModalEsc] = useState<Escalation | null>(null);
  const [linkedAlertsEsc, setLinkedAlertsEsc] = useState<Escalation | null>(null);
  const [activityLogs, setActivityLogs] = useState<Record<string, Activity[]>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Attack Timeline State ---
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [currentTimeline, setCurrentTimeline] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [activeTimelineEscalation, setActiveTimelineEscalation] = useState<Escalation | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // --- Reporting State ---
  const [reportOptionEsc, setReportOptionEsc] = useState<Escalation | null>(null);
  const [showReportViewer, setShowReportViewer] = useState(false);
  const [reportContent, setReportContent] = useState<any>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeReportEscalation, setActiveReportEscalation] = useState<Escalation | null>(null);
  const [autoOpenReportAfterTimeline, setAutoOpenReportAfterTimeline] = useState(false);
  const [selectedAlertEvent, setSelectedAlertEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!timelineLoading && autoOpenReportAfterTimeline && activeTimelineEscalation) {
      setReportOptionEsc(activeTimelineEscalation);
      setAutoOpenReportAfterTimeline(false);
    }
  }, [timelineLoading, autoOpenReportAfterTimeline, activeTimelineEscalation]);

  useEffect(() => {
    if (showTimeline) {
      setAiEscalation(null);
      setShowReportViewer(false);
    }
  }, [showTimeline]);

  useEffect(() => {
    if (aiEscalation) {
      setShowTimeline(false);
      setShowReportViewer(false);
    }
  }, [aiEscalation]);

  useEffect(() => {
    if (showReportViewer) {
      setAiEscalation(null);
      setShowTimeline(false);
    }
  }, [showReportViewer]);

  const mapAlertToKillChainPhase = (alert: any) => {
    const desc = (alert.description || '').toLowerCase();
    
    // Reconnaissance
    if (desc.includes('scan') || desc.includes('nmap') || 
        desc.includes('masscan') || desc.includes('recon')) {
      return { 
        phase: 'Reconnaissance', 
        event_type: 'Network Scan',
        explanation: 'Attacker scanning for open ports and services',
        isPivot: false
      };
    }
    
    // Initial Access — Failed attempts
    if (desc.includes('failed') || desc.includes('failure') ||
        desc.includes('invalid user') || 
        desc.includes('authentication failed') ||
        desc.includes('brute force')) {
      return { 
        phase: 'Initial Access', 
        event_type: 'Failed Authentication',
        explanation: 'Multiple failed login attempts — brute force pattern detected',
        isPivot: false
      };
    }
    
    // Initial Access — Success (PIVOT POINT)
    if (desc.includes('success') || 
        desc.includes('accepted') ||
        desc.includes('logged in') ||
        desc.includes('session opened')) {
      return { 
        phase: 'Initial Access', 
        event_type: 'Successful Login',
        explanation: 'Attacker successfully authenticated — this is a critical pivot point',
        isPivot: true
      };
    }
    
    // Execution
    if (desc.includes('powershell') || desc.includes('command') ||
        desc.includes('script') || desc.includes('exec') ||
        desc.includes('process')) {
      return { 
        phase: 'Execution', 
        event_type: 'Code Execution',
        explanation: 'Suspicious command or script execution detected',
        isPivot: true
      };
    }
    
    // Privilege Escalation
    if (desc.includes('sudo') || desc.includes('root') ||
        desc.includes('privilege') || desc.includes('escalat') ||
        desc.includes('su ') || desc.includes('suid')) {
      return { 
        phase: 'Privilege Escalation', 
        event_type: 'Privilege Escalation',
        explanation: 'Attacker attempting to gain elevated system privileges',
        isPivot: true
      };
    }
    
    // Persistence
    if (desc.includes('cron') || desc.includes('startup') ||
        desc.includes('service') || desc.includes('autorun') ||
        desc.includes('registry') || desc.includes('ssh key')) {
      return { 
        phase: 'Persistence', 
        event_type: 'Persistence Mechanism',
        explanation: 'Attacker establishing persistent access to the system',
        isPivot: false
      };
    }
    
    // Defense Evasion
    if (desc.includes('log') && 
        (desc.includes('clear') || desc.includes('delet')) ||
        desc.includes('hidden') || desc.includes('evasion')) {
      return { 
        phase: 'Defense Evasion', 
        event_type: 'Log Tampering',
        explanation: 'Attacker attempting to cover their tracks',
        isPivot: false
      };
    }
    
    // Lateral Movement
    if (desc.includes('lateral') || desc.includes('rdp') ||
        desc.includes('smb') || desc.includes('pass the') ||
        (desc.includes('ssh') && desc.includes('internal'))) {
      return { 
        phase: 'Lateral Movement', 
        event_type: 'Lateral Movement',
        explanation: 'Attacker moving to other systems on the network',
        isPivot: true
      };
    }
    
    // Credential Access
    if (desc.includes('credential') || desc.includes('password') ||
        desc.includes('hash') || desc.includes('dump') ||
        desc.includes('keylog')) {
      return { 
        phase: 'Credential Access', 
        event_type: 'Credential Theft',
        explanation: 'Attacker attempting to steal credentials',
        isPivot: true
      };
    }
    
    // Exfiltration
    if (desc.includes('exfil') || desc.includes('upload') ||
        desc.includes('transfer') || desc.includes('large') ||
        desc.includes('outbound')) {
      return { 
        phase: 'Exfiltration', 
        event_type: 'Data Exfiltration',
        explanation: 'Potential data theft — large outbound transfer detected',
        isPivot: true
      };
    }
    
    // Default
    return { 
      phase: 'Initial Access', 
      event_type: 'Security Event',
      explanation: alert.description || 'Security event detected',
      isPivot: false
    };
  };

  const determineAttackType = (phases: string[]) => {
    if (phases.includes('Exfiltration')) 
      return 'Full Kill Chain — Data Exfiltration';
    if (phases.includes('Lateral Movement')) 
      return 'Network Intrusion with Lateral Movement';
    if (phases.includes('Privilege Escalation')) 
      return 'Brute Force to Privilege Escalation';
    if (phases.includes('Execution')) 
      return 'Remote Code Execution Attack';
    if (phases.includes('Initial Access') && 
        phases.filter(p => p === 'Initial Access').length > 3)
      return 'Credential Brute Force Attack';
    return 'Multi-Stage Attack';
  };

  const buildAttackTimeline = async (escalation: Escalation) => {
    if (!currentClient) return;
    setTimelineLoading(true);
    setLoadingStep(0);
    setActiveTimelineEscalation(escalation);
    setShowTimeline(true);

    const steps = [0, 1, 2, 3];
    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < 3) {
        currentStep++;
        setLoadingStep(currentStep);
      } else {
        clearInterval(stepInterval);
      }
    }, 800);

    try {
      // Check if timeline already exists for this escalation
      const { data: existing } = await supabase
        .from('attack_timelines')
        .select('*, attack_timeline_events(*)')
        .eq('escalation_id', escalation.id)
        .maybeSingle();

      if (existing && existing.attack_timeline_events?.length > 0) {
        setCurrentTimeline(existing);
        setTimelineEvents(
          existing.attack_timeline_events
            .sort((a: any, b: any) => 
              new Date(a.event_timestamp).getTime() - 
              new Date(b.event_timestamp).getTime()
            )
        );
        clearInterval(stepInterval);
        setLoadingStep(3);
        setTimelineLoading(false);
        return;
      }

      // Get the source IP and agent from the escalation
      // to find related alerts
      const { data: linkedAlert } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', escalation.alert_id)
        .single();

      const sourceIp = linkedAlert?.source_ip;
      const agentName = linkedAlert?.agent_name;
      const alertTime = new Date(linkedAlert?.timestamp || escalation.escalated_at);
      
      // Fetch alerts ±60 minutes from the trigger alert
      // by same source IP OR same agent
      const windowStart = new Date(alertTime.getTime() - 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(alertTime.getTime() + 60 * 60 * 1000).toISOString();

      let relatedAlerts: any[] = [];

      // Query by source IP if available
      if (sourceIp && sourceIp !== 'N/A') {
        const { data: ipAlerts } = await supabase
          .from('alerts')
          .select('*')
          .eq('client_id', currentClient.id)
          .eq('source_ip', sourceIp)
          .gte('timestamp', windowStart)
          .lte('timestamp', windowEnd)
          .order('timestamp', { ascending: true });
        
        if (ipAlerts) relatedAlerts.push(...ipAlerts);
      }

      // Query by agent name
      if (agentName) {
        const { data: agentAlerts } = await supabase
          .from('alerts')
          .select('*')
          .eq('client_id', currentClient.id)
          .eq('agent_name', agentName)
          .gte('timestamp', windowStart)
          .lte('timestamp', windowEnd)
          .order('timestamp', { ascending: true });
        
        if (agentAlerts) relatedAlerts.push(...agentAlerts);
      }

      // Deduplicate by alert id
      const seen = new Set();
      relatedAlerts = relatedAlerts.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });

      // Sort by timestamp
      relatedAlerts.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      if (relatedAlerts.length === 0) {
        relatedAlerts = [linkedAlert].filter(Boolean);
      }

      // Map each alert to a kill chain phase
      const mappedEvents = relatedAlerts.map((alert, idx) => {
        const phase = mapAlertToKillChainPhase(alert);
        return {
          alert_id: alert.id,
          client_id: currentClient.id,
          event_timestamp: alert.timestamp,
          event_type: phase.event_type,
          kill_chain_phase: phase.phase,
          rule_id: alert.rule_id,
          rule_description: alert.description,
          severity: alert.severity,
          source_ip: alert.source_ip,
          agent_name: alert.agent_name,
          raw_log: alert.raw_log,
          ai_explanation: phase.explanation,
          is_pivot_point: phase.isPivot,
          sequence_order: idx + 1
        };
      });

      // Calculate time span
      const firstEvent = new Date(relatedAlerts[0]?.timestamp);
      const lastEvent = new Date(relatedAlerts[relatedAlerts.length - 1]?.timestamp);
      const timeSpanMinutes = Math.round((lastEvent.getTime() - firstEvent.getTime()) / 60000);

      // Find furthest kill chain stage reached
      const phaseOrder = [
        'Reconnaissance', 'Initial Access', 'Execution',
        'Persistence', 'Privilege Escalation', 
        'Defense Evasion', 'Credential Access',
        'Lateral Movement', 'Collection', 'Exfiltration'
      ];
      
      const phases = mappedEvents.map(e => e.kill_chain_phase);
      let furthestPhase = 'Initial Access';
      phaseOrder.forEach(phase => {
        if (phases.includes(phase)) furthestPhase = phase;
      });

      // Determine attack type from phases present
      const attackType = determineAttackType(phases);

      // Use Gemini API to generate the AI narrative
      const alertSummary = relatedAlerts.map(a => 
        `[${a.timestamp}] ${a.description} ` +
        `(severity: ${a.severity}, IP: ${a.source_ip || 'N/A'}, ` +
        `agent: ${a.agent_name})`
      ).join('\n');

      const narrativePrompt = `You are a senior SOC analyst. 
Analyze these ${relatedAlerts.length} security events 
and write a concise attack narrative (3-4 sentences max).
Identify the attack pattern, what the attacker was trying 
to achieve, and the risk level. Be specific and actionable.

Events:
${alertSummary}

Respond with ONLY a JSON object:
{
  "narrative": "Your attack story here",
  "attack_type": "e.g. Brute Force to Privilege Escalation",
  "risk_assessment": "Critical/High/Medium/Low",
  "attacker_goal": "What attacker was trying to do",
  "immediate_action": "Most important action to take now"
}`;

      let aiResult = {
        narrative: "Multiple related security events detected. Manual investigation recommended.",
        attack_type: attackType,
        risk_assessment: "High",
        attacker_goal: "Unauthorized access attempt",
        immediate_action: "Review all related alerts and block source IP"
      };

      try {
        const parsed = await generateAINarrative(narrativePrompt, "You are a senior SOC analyst.");
        if (parsed) {
          aiResult = { ...aiResult, ...parsed };
        }
      } catch (e) {
        console.error('AI narrative failed:', e);
      }

      // Save timeline to Supabase
      const { data: newTimeline, error: timelineError } = await supabase
        .from('attack_timelines')
        .insert({
          escalation_id: escalation.id,
          client_id: currentClient.id,
          alert_id: escalation.alert_id,
          title: aiResult.attack_type || 'Attack Timeline',
          ai_narrative: aiResult.narrative,
          attack_type: aiResult.attack_type,
          kill_chain_stage: furthestPhase,
          confidence_score: Math.min(95, 60 + relatedAlerts.length * 5),
          total_events: relatedAlerts.length,
          time_span_minutes: timeSpanMinutes,
          attacker_ip: sourceIp || 'Unknown',
          target_agent: agentName || 'Unknown',
          status: 'active'
        })
        .select()
        .single();

      if (timelineError) throw timelineError;

      // Save events
      if (newTimeline) {
        const eventsToInsert = mappedEvents.map(e => ({
          ...e,
          timeline_id: newTimeline.id
        }));

        await supabase
          .from('attack_timeline_events')
          .insert(eventsToInsert);

        const { data: savedEvents } = await supabase
          .from('attack_timeline_events')
          .select('*')
          .eq('timeline_id', newTimeline.id)
          .order('sequence_order', { ascending: true });

        setCurrentTimeline({ 
          ...newTimeline, 
          ai_result: aiResult 
        });
        setTimelineEvents(savedEvents || []);
      }

    } catch (error) {
      console.error('Timeline build error:', error);
    } finally {
      clearInterval(stepInterval);
      setLoadingStep(3);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    const navDataStr = window.sessionStorage.getItem('nav_data');
    if (navDataStr) {
      try {
        const navData = JSON.parse(navDataStr);
        if (navData.alertId) {
          setSearchQuery(navData.alertId);
        }
        window.sessionStorage.removeItem('nav_data');
      } catch (e) {
        console.error('Failed to parse nav_data:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (searchQuery && escalations.length > 0 && !expandedId) {
      const found = escalations.find(e => e.alert_id === searchQuery || e.escalation_id === searchQuery);
      if (found) {
        setExpandedId(found.id);
        fetchActivity(found.id);
      }
    }
  }, [escalations, searchQuery, expandedId]);

  useEffect(() => {
    if (!currentClient) return;
    fetchEscalations();

    const subscription = supabase
      .channel('escalations_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'escalations',
        filter: `client_id=eq.${currentClient.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEscalations(prev => [payload.new as Escalation, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setEscalations(prev => prev.map(e =>
            e.id === payload.new.id ? payload.new as Escalation : e
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentClient]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      
      escalations.forEach(async (esc) => {
        if (!esc.sla_breached && 
            esc.sla_deadline && 
            new Date(esc.sla_deadline) < new Date() &&
            esc.status !== 'Resolved') {
          await supabase
            .from('escalations')
            .update({ sla_breached: true })
            .eq('id', esc.id);
        }
      });
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [escalations]);

  const fetchEscalations = async () => {
    if (!currentClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('escalations')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('escalated_at', { ascending: false });
      
      if (error) throw error;
      setEscalations(data || []);

      // Fetch workspaces to show "View Investigation" button (both active and closed)
      const { data: wsData } = await supabase
        .from('investigation_workspaces')
        .select('id, escalation_id, status')
        .eq('client_id', currentClient.id);
      
      const wsMap: Record<string, string> = {};
      wsData?.forEach(ws => {
        // Prefer active workspaces if multiple exist (unlikely), otherwise take closed ones
        if (!wsMap[ws.escalation_id] || ws.status === 'active') {
          wsMap[ws.escalation_id] = ws.id;
        }
      });
      setActiveWorkspaces(wsMap);
    } catch (e) {
      console.error('Error fetching escalations:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async (escId: string) => {
    try {
      const { data, error } = await supabase
        .from('escalation_activity')
        .select('*')
        .eq('escalation_id', escId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setActivityLogs(prev => ({ ...prev, [escId]: data || [] }));
    } catch (e) {
      console.error('Error fetching activity:', e);
    }
  };

  // --- Investigation Workspace Handlers ---

  const handleOpenInvestigationWorkspace = async (esc: Escalation) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Check if workspace already exists for this escalation (any status)
      const { data: existing } = await supabase
        .from('investigation_workspaces')
        .select('*')
        .eq('escalation_id', esc.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let workspace = existing;
      
      if (!workspace) {
        // Create new workspace
        const { data: newWorkspace, error: wsError } = await supabase
          .from('investigation_workspaces')
          .insert({
            escalation_id: esc.id,
            client_id: currentClient.id,
            opened_by: user.email,
            status: 'active',
            checklist: {
              fp_check: false,
              ip_check: false,
              agent_check: false,
              related_check: false,
              history_check: false,
              blast_check: false,
              notes_check: false,
              verdict_check: false
            }
          })
          .select()
          .single();
          
        if (wsError) throw wsError;
        workspace = newWorkspace;

        // Update activeWorkspaces mapping to trigger button label change
        setActiveWorkspaces(prev => ({ ...prev, [esc.id]: newWorkspace.id }));

        // Also create a case linked to this escalation
        const { data: newCase, error: caseError } = await supabase
          .from('cases')
          .insert({
            title: esc.title,
            description: `Case created from escalation ${esc.escalation_id}`,
            status: 'Investigating',
            severity: esc.severity,
            priority: esc.priority,
            client_id: currentClient.id,
            alert_id: esc.alert_id,
            agent_name: esc.agent_name,
            escalated_by: user.email,
            escalated_at: new Date().toISOString(),
            sla_deadline: esc.sla_deadline
          })
          .select()
          .single();

        if (caseError) console.error('Error creating linked case:', caseError);

        // Link case to workspace
        if (newCase) {
          await supabase
            .from('investigation_workspaces')
            .update({ case_id: newCase.id })
            .eq('id', workspace.id);
          workspace.case_id = newCase.id;
        }
      }
      
      setActiveWorkspace(workspace);
      setActiveWorkspaceEsc(esc);
      setShowWorkspace(true);
      await loadWorkspaceData(workspace, esc, false);
    } catch (err) {
      console.error('Error opening investigation workspace:', err);
      showToast('Failed to initialize workspace', 'error');
    }
  };

  const loadWorkspaceData = async (workspace: any, esc: Escalation, showLoading = true) => {
    if (showLoading) setWorkspaceLoading(true);
    
    try {
      const { data: linkedAlert } = esc.alert_id ? await supabase.from('alerts').select('*').eq('id', esc.alert_id).single() : { data: null };
      
      if (!linkedAlert && !esc.alert_id) {
         setWorkspaceLoading(false);
         return;
      }

      const agentName = linkedAlert?.agent_name || esc.agent_name;

      // Parallel helper for agent profile with fallback logic
      const fetchAgentProfile = async (name: string) => {
        if (!name || !currentClient) return null;
        
        // Try exact name match
        const { data: agent } = await supabase
          .from('agents')
          .select('*')
          .eq('client_id', currentClient.id)
          .ilike('name', name.trim())
          .maybeSingle();
        
        if (agent) return agent;
        
        // Try partial match
        const { data: agents } = await supabase
          .from('agents')
          .select('*')
          .eq('client_id', currentClient.id)
          .ilike('name', `%${name.trim()}%`)
          .limit(1);
        
        return agents?.[0] || null;
      };

      // Helper for broad timeline
      const fetchIncidentTimeline = async (alert: any) => {
        if (!alert || !currentClient) return [];
        
        const alertTime = new Date(alert.timestamp);
        const windowStart = new Date(alertTime.getTime() - 60 * 60 * 1000).toISOString();
        const windowEnd = new Date(alertTime.getTime() + 60 * 60 * 1000).toISOString();
        
        let timeline: any[] = [];
        
        // Same agent window
        if (alert.agent_name) {
          const { data } = await supabase
            .from('alerts')
            .select('*')
            .eq('client_id', currentClient.id)
            .ilike('agent_name', `%${alert.agent_name}%`)
            .gte('timestamp', windowStart)
            .lte('timestamp', windowEnd)
            .order('timestamp', { ascending: true })
            .limit(30);
          if (data) timeline.push(...data);
        }
        
        // Same source IP window
        if (alert.source_ip && alert.source_ip !== 'N/A') {
          const { data } = await supabase
            .from('alerts')
            .select('*')
            .eq('client_id', currentClient.id)
            .eq('source_ip', alert.source_ip)
            .gte('timestamp', windowStart)
            .lte('timestamp', windowEnd)
            .order('timestamp', { ascending: true })
            .limit(30);
          if (data) timeline.push(...data);
        }
        
        // Same rule wide window
        if (alert.rule_id && alert.agent_name) {
          const dayStart = new Date(alertTime.getTime() - 24 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from('alerts')
            .select('*')
            .eq('client_id', currentClient.id)
            .eq('rule_id', alert.rule_id)
            .ilike('agent_name', `%${alert.agent_name}%`)
            .gte('timestamp', dayStart)
            .order('timestamp', { ascending: true })
            .limit(20);
          if (data) timeline.push(...data);
        }
        
        const seen = new Set();
        return timeline.filter(a => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      };

      // Helper for correlated alerts with multi-strategy matching
      const fetchCorrelatedAlerts = async (linkedAlert: any) => {
        if (!linkedAlert || !currentClient) return { groups: [], alerts: [] };
        
        let relatedAlerts: any[] = [];
        
        // Strategy 1: Same rule_id
        if (linkedAlert.rule_id) {
          const { data } = await supabase
            .from('alerts')
            .select('id, alert_number, description, severity, timestamp, agent_name, source_ip, rule_id, status, raw_log, rule_level')
            .eq('client_id', currentClient.id)
            .eq('rule_id', linkedAlert.rule_id)
            .neq('id', linkedAlert.id)
            .order('timestamp', { ascending: false })
            .limit(15);
          if (data) relatedAlerts.push(...data);
        }
        
        // Strategy 2: Same source_ip (if exists)
        if (linkedAlert.source_ip && linkedAlert.source_ip !== 'N/A') {
          const { data } = await supabase
            .from('alerts')
            .select('id, alert_number, description, severity, timestamp, agent_name, source_ip, rule_id, status, raw_log, rule_level')
            .eq('client_id', currentClient.id)
            .eq('source_ip', linkedAlert.source_ip)
            .neq('id', linkedAlert.id)
            .order('timestamp', { ascending: false })
            .limit(15);
          if (data) relatedAlerts.push(...data);
        }

        // Strategy 3: Same agent_name and higher severity
        if (linkedAlert.agent_name) {
          const { data } = await supabase
            .from('alerts')
            .select('id, alert_number, description, severity, timestamp, agent_name, source_ip, rule_id, status, raw_log, rule_level')
            .eq('client_id', currentClient.id)
            .eq('agent_name', linkedAlert.agent_name)
            .in('severity', ['High', 'Critical'])
            .neq('id', linkedAlert.id)
            .order('timestamp', { ascending: false })
            .limit(15);
          if (data) relatedAlerts.push(...data);
        }

        // Strategy 4: Description fuzzy match (similar threats)
        const simplifiedDesc = (linkedAlert.description || '').split(' ').slice(0, 3).join('%');
        if (simplifiedDesc.length > 5) {
          const { data } = await supabase
            .from('alerts')
            .select('id, alert_number, description, severity, timestamp, agent_name, source_ip, rule_id, status, raw_log, rule_level')
            .eq('client_id', currentClient.id)
            .ilike('description', `%${simplifiedDesc}%`)
            .neq('id', linkedAlert.id)
            .order('timestamp', { ascending: false })
            .limit(10);
          if (data) relatedAlerts.push(...data);
        }

        // Fetch groups based on rule_id or source_ip
        const { data: groups } = await supabase
          .from('alert_groups')
          .select('*')
          .eq('client_id', currentClient.id)
          .or(`rule_id.eq.${linkedAlert.rule_id},latest_source_ip.eq.${linkedAlert.source_ip || 'NONE'}`)
          .order('alert_count', { ascending: false })
          .limit(10);

        // Strategy 5: Alerts from identified groups
        if (groups && groups.length > 0) {
          const groupRuleIds = groups.map((g: any) => g.rule_id).filter(Boolean);
          if (groupRuleIds.length > 0) {
            const { data } = await supabase
              .from('alerts')
              .select('id, alert_number, description, severity, timestamp, agent_name, source_ip, rule_id, status, raw_log, rule_level')
              .eq('client_id', currentClient.id)
              .in('rule_id', groupRuleIds)
              .neq('id', linkedAlert.id)
              .order('timestamp', { ascending: false })
              .limit(15);
            if (data) relatedAlerts.push(...data);
          }
        }

        // Deduplicate
        const uniqueAlerts = Array.from(new Map(relatedAlerts.map(a => [a.id, a])).values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 30);

        return { 
          groups: groups || [], 
          alerts: uniqueAlerts 
        };
      };

      // Helper for similar cases
      const fetchSimilarCases = async (alert: any) => {
        if (!alert || !currentClient) return [];
        const { data } = await supabase.from('cases').select('id, case_number, title, status, severity, verdict, created_at, resolved_at').eq('client_id', currentClient.id).or(`rule_id.eq.${alert.rule_id},source_ip.eq.${alert.source_ip || 'NONE'}`).order('created_at', { ascending: false }).limit(5);
        return data || [];
      };

      const [
        notesResult,
        evidenceResult,
        threatIntelResult,
        agentAlertsResult,
        ipHistoryResult,
        agentProfile,
        timelineAlerts,
        correlatedData,
        similarCases
      ] = await Promise.all([
        supabase.from('investigation_notes').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('investigation_evidence').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('workspace_threat_intel').select('*').eq('workspace_id', workspace.id),
        agentName ? supabase.from('alerts').select('id, alert_number, description, severity, timestamp, rule_id, source_ip').eq('client_id', currentClient.id).ilike('agent_name', `%${agentName}%`).order('timestamp', { ascending: false }).limit(10) : { data: [] },
        linkedAlert?.source_ip && linkedAlert.source_ip !== 'N/A' ? supabase.from('alerts').select('id, alert_number, description, severity, timestamp, agent_name, rule_id, status, raw_log').eq('client_id', currentClient.id).eq('source_ip', linkedAlert.source_ip).neq('id', linkedAlert.id).order('timestamp', { ascending: false }).limit(15) : { data: [] },
        fetchAgentProfile(agentName || ''),
        fetchIncidentTimeline(linkedAlert),
        fetchCorrelatedAlerts(linkedAlert),
        fetchSimilarCases(linkedAlert)
      ]);

      setWorkspaceData({
        linkedAlert,
        notes: notesResult.data || [],
        evidence: evidenceResult.data || [],
        threatIntel: threatIntelResult.data || [],
        agentAlerts: agentAlertsResult.data || [],
        timelineAlerts,
        ipHistory: ipHistoryResult.data || [],
        agentProfile,
        correlatedData,
        similarCases
      });
    } catch (err) {
      console.error('Error loading workspace data:', err);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleAddAlertAsEvidence = async (alert: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('investigation_evidence').insert({
      workspace_id: activeWorkspace.id,
      escalation_id: activeWorkspaceEsc.id,
      client_id: currentClient.id,
      evidence_type: 'alert',
      title: `Alert: ${alert.description}`,
      description: `Related alert detected at ${alert.timestamp}`,
      data: alert,
      source: `Wazuh Rule ${alert.rule_id}`,
      confidence: 'High',
      added_by: user.email
    });
    await loadWorkspaceData(activeWorkspace, activeWorkspaceEsc, false);
    showToast('Alert added as evidence', 'success');
  };

  const handleRunThreatIntel = async (ip: string) => {
    if (!ip || ip === 'N/A') return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setThreatIntelLoading(true);

    // Check cache first
    const { data: cached } = await supabase
      .from('threat_intel_cache')
      .select('*')
      .eq('ip', ip)
      .maybeSingle();

    let intelData = {
      ip,
      abuseipdb_score: 0,
      abuseipdb_country: 'Unknown',
      abuseipdb_isp: 'Unknown',
      vt_malicious: 0,
      vt_suspicious: 0,
      vt_harmless: 0,
      combined_score: 0,
      final_verdict: 'Unknown',
      raw_data: cached || {}
    };

    if (cached && cached.details) {
      intelData.abuseipdb_score = cached.details.abuseConfidenceScore || 0;
      intelData.abuseipdb_country = cached.details.countryCode || 'Unknown';
      intelData.abuseipdb_isp = cached.details.isp || 'Unknown';
      intelData.combined_score = intelData.abuseipdb_score;
      intelData.final_verdict = intelData.abuseipdb_score > 50 ? 'Malicious' : intelData.abuseipdb_score > 20 ? 'Suspicious' : 'Clean';
    }

    // Save to workspace threat intel
    await supabase.from('workspace_threat_intel').upsert({
      workspace_id: activeWorkspace.id,
      client_id: currentClient.id,
      ...intelData,
      checked_by: user.email
    }, { onConflict: 'workspace_id,ip' });

    setThreatIntelLoading(false);
    await loadWorkspaceData(activeWorkspace, activeWorkspaceEsc, false);
  };

  const handleAddNote = async (noteText: string, isKeyFinding: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('investigation_notes').insert({
      workspace_id: activeWorkspace.id,
      escalation_id: activeWorkspaceEsc.id,
      client_id: currentClient.id,
      note: noteText,
      is_key_finding: isKeyFinding,
      added_by: user.email
    });
    await loadWorkspaceData(activeWorkspace, activeWorkspaceEsc, false);
    showToast('Observation added', 'success');
  };

  const handleToggleKeyFinding = async (id: string, isKey: boolean) => {
    await supabase.from('investigation_notes').update({ is_key_finding: isKey }).eq('id', id);
    await loadWorkspaceData(activeWorkspace, activeWorkspaceEsc, false);
  };

  const handleAddEvidence = async (type: string, title: string, description: string, confidence: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('investigation_evidence').insert({
      workspace_id: activeWorkspace.id,
      escalation_id: activeWorkspaceEsc.id,
      client_id: currentClient.id,
      evidence_type: type,
      title,
      description,
      confidence,
      source: 'Manual entry by analyst',
      added_by: user.email
    });
    await loadWorkspaceData(activeWorkspace, activeWorkspaceEsc, false);
    showToast('Evidence logged', 'success');
  };

  const handleChecklist = async (itemId: string, checked: boolean) => {
    const newChecklist = { ...activeWorkspace.checklist, [itemId]: checked };
    await supabase.from('investigation_workspaces').update({ checklist: newChecklist }).eq('id', activeWorkspace.id);
    setActiveWorkspace(prev => ({ ...prev, checklist: newChecklist }));
  };

  const handleAddChecklistItem = async (label: string) => {
    const defaultItems = [
      { id: 'fp_check', label: 'Confirmed this is not a false positive' },
      { id: 'ip_check', label: 'Checked attacker IP reputation' },
      { id: 'agent_check', label: 'Reviewed agent activity before and after' },
      { id: 'related_check', label: 'Searched for related alerts across all agents' },
      { id: 'history_check', label: 'Checked if same IP attacked before' },
      { id: 'blast_check', label: 'Determined blast radius — other affected systems' },
      { id: 'notes_check', label: 'Documented key findings in investigation notes' },
      { id: 'verdict_check', label: 'Ready to set final verdict' },
    ];

    const currentItems = activeWorkspace.checklist_items || defaultItems;
    const newItem = { id: `custom_${Date.now()}`, label };
    const newItems = [...currentItems, newItem];
    
    await supabase.from('investigation_workspaces')
      .update({ checklist_items: newItems })
      .eq('id', activeWorkspace.id);
      
    setActiveWorkspace(prev => ({ ...prev, checklist_items: newItems }));
    addNotification({ type: 'rule_deployed', title: 'Task Added', description: 'Investigation checklist updated' });
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    const defaultItems = [
      { id: 'fp_check', label: 'Confirmed this is not a false positive' },
      { id: 'ip_check', label: 'Checked attacker IP reputation' },
      { id: 'agent_check', label: 'Reviewed agent activity before and after' },
      { id: 'related_check', label: 'Searched for related alerts across all agents' },
      { id: 'history_check', label: 'Checked if same IP attacked before' },
      { id: 'blast_check', label: 'Determined blast radius — other affected systems' },
      { id: 'notes_check', label: 'Documented key findings in investigation notes' },
      { id: 'verdict_check', label: 'Ready to set final verdict' },
    ];
    
    const currentItems = activeWorkspace.checklist_items || defaultItems;
    const newItems = currentItems.filter((i: any) => i.id !== itemId);
    
    const newChecklist = { ...activeWorkspace.checklist };
    delete newChecklist[itemId];

    await supabase.from('investigation_workspaces')
      .update({ checklist_items: newItems, checklist: newChecklist })
      .eq('id', activeWorkspace.id);
      
    setActiveWorkspace(prev => ({ ...prev, checklist_items: newItems, checklist: newChecklist }));
  };

  const handleGenerateWorkspaceReport = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const keyFindings = (workspaceData.notes || [])
      .filter((n: any) => n.is_key_finding)
      .map((n: any) => n.note);
    
    const allNotes = (workspaceData.notes || []).map((n: any) => n.note);
    
    const evidenceSummary = (workspaceData.evidence || []).map((e: any) => 
      `${e.evidence_type}: ${e.title} — ${e.description} (Confidence: ${e.confidence})`
    );
    
    const threatIntelSummary = (workspaceData.threatIntel || []).map((t: any) =>
      `IP ${t.ip}: AbuseIPDB ${t.abuseipdb_score}/100, VT ${t.vt_malicious} malicious, Verdict: ${t.final_verdict}`
    );

    const prompt = `You are a senior SOC analyst writing a professional incident report.
    
INVESTIGATION WORKSPACE FINDINGS:

LINKED ALERT:
${JSON.stringify(workspaceData.linkedAlert, null, 2)}

ANALYST KEY FINDINGS (${(workspaceData.notes || []).filter((n: any) => n.is_key_finding).length}):
${(workspaceData.notes || []).filter((n: any) => n.is_key_finding).map((n: any) => '- ' + n.note).join('\n') || 'None'}

ALL INVESTIGATION NOTES:
${(workspaceData.notes || []).map((n: any) => '- ' + n.note).join('\n') || 'None'}

EVIDENCE COLLECTED (${(workspaceData.evidence || []).length} items):
${(workspaceData.evidence || []).map((e: any) => `- [${e.confidence} confidence] ${e.title}: ${e.description}`).join('\n') || 'None'}

THREAT INTELLIGENCE:
${(workspaceData.threatIntel || []).map((t: any) => `IP ${t.ip}: Score ${t.combined_score}/100 — ${t.final_verdict} — Country: ${t.abuseipdb_country}`).join('\n') || 'Not checked'}

CORRELATED ALERTS: ${workspaceData.correlatedData?.alerts?.length || 0} related alerts found with same rule
SIMILAR PAST CASES: ${workspaceData.similarCases?.length || 0} similar cases — ${(workspaceData.similarCases || []).filter((c: any) => c.verdict === 'False Positive').length || 0} previously False Positive

CHECKLIST COMPLETION: ${Object.values(activeWorkspace.checklist || {}).filter(Boolean).length}/8 items complete

Based on this analyst investigation, generate a detailed professional incident report in JSON format. Use the analyst findings to enhance and ground the report in real evidence.
    
Return ONLY valid JSON matching this structure:
{
  executive_summary: string,
  incident_details: { alert_id, title, severity, timestamp, agent, source_ip, rule_id, priority },
  attack_analysis: { description, attack_chain: string[], mitre_techniques: string[], attack_type },
  ioc_analysis: [{ type, value, verdict, threat_score, source }],
  impact_assessment: { affected_systems, data_at_risk, business_impact, containment_status, true_positive, confidence_level },
  recommendations: { immediate: string[], short_term: string[], long_term: string[] },
  analyst_notes: string,
  conclusion: string
}`;

    setReportOptionEsc(null);
    setActiveReportEscalation(activeWorkspaceEsc);
    setIsGeneratingReport(true);
    setShowReportViewer(true);
    
    try {
      const report = await generateStructuredSOCReport({
        type: 'Escalation', // Reuse context
        alertData: workspaceData.linkedAlert,
        analystName: user.email,
      });

      // Overlay the custom analysis on top
      const customReport = await generateAINarrative(prompt);
      setReportContent(customReport);
      setReportTitle(`Investigation Report — ${activeWorkspaceEsc.title}`);
    } catch (e) {
      console.error('Report generation failed:', e);
      showToast('Report generation failed', 'error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleWorkspaceVerdict = async (verdict: string, reason: string, confidence: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Update workspace
    await supabase.from('investigation_workspaces').update({
      verdict,
      verdict_reason: reason,
      verdict_confidence: confidence,
      status: 'closed',
      closed_at: new Date().toISOString()
    }).eq('id', activeWorkspace.id);

    // Resolve the escalation
    await supabase.from('escalations').update({
      status: verdict === 'False Positive' ? 'False Positive' : 'Resolved',
      resolution_type: verdict,
      resolution_notes: reason,
      resolved_at: new Date().toISOString()
    }).eq('id', activeWorkspaceEsc.id);

    // Update linked case if exists
    if (activeWorkspace.case_id) {
      await supabase.from('cases').update({
        verdict,
        verdict_reason: reason,
        status: 'Resolved',
        resolved_at: new Date().toISOString(),
        closed_by: user.email
      }).eq('id', activeWorkspace.case_id);
    }

    // Log to escalation activity
    await supabase.from('escalation_activity').insert({
      escalation_id: activeWorkspaceEsc.id,
      action: `Investigation Complete — ${verdict}`,
      performed_by: user.email,
      details: `Verdict: ${verdict} (${confidence}% confidence). ${reason}`
    });

    setShowWorkspace(false);
    setShowVerdictModal(false);
    fetchEscalations();
    showToast(`Investigation complete — ${verdict}`, 'success');
  };

  const handleBlockIP = async (ip: string) => {
    if (!ip || ip === 'N/A') return;
    showToast(`${ip} flagged for blocking in firewall`, 'info');
  };

  const handleAddCurrentFindingsAsEvidence = async () => {
    if (!activeWorkspace) return;
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
    await handleAddEvidence(
      'analyst_note', 
      'Current Investigation Snapshot', 
      `Capture of progress: ${checklistItems.filter(i => activeWorkspace.checklist?.[i.id]).length}/8 checks complete. ${workspaceData.notes.length} notes recorded.`,
      'Medium'
    );
  };

  // --- Realtime for Notes ---
  useEffect(() => {
    if (!showWorkspace || !activeWorkspace) return;
    
    const channel = supabase.channel('workspace_notes_' + activeWorkspace.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'investigation_notes',
        filter: `workspace_id=eq.${activeWorkspace.id}`
      }, () => loadWorkspaceData(activeWorkspace, activeWorkspaceEsc))
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showWorkspace, activeWorkspace]);

  const handleUpdateNotes = async (escId: string, notes: string) => {
    try {
      await supabase
        .from('escalations')
        .update({ investigation_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', escId);
    } catch (e) {
      console.error('Error updating notes:', e);
    }
  };

  const handleUpdateAssignment = async (escId: string, assignedTo: string) => {
    try {
      await supabase
        .from('escalations')
        .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
        .eq('id', escId);
      
      await supabase.from('escalation_activity').insert({
        escalation_id: escId,
        action: 'Assignment Updated',
        performed_by: user?.email || 'System',
        details: `Assigned to: ${assignedTo}`
      });
      
      fetchActivity(escId);
    } catch (e) {
      console.error('Error updating assignment:', e);
    }
  };

  const handleNotifyClient = async (esc: Escalation, message: string) => {
    try {
      await supabase.from('escalation_communications').insert({
        escalation_id: esc.id,
        client_id: currentClient?.id,
        direction: 'outbound',
        message: message,
        sent_by: user?.email || 'System',
        sent_at: new Date().toISOString()
      });

      await supabase
        .from('escalations')
        .update({ client_notified: true, updated_at: new Date().toISOString() })
        .eq('id', esc.id);

      await supabase.from('escalation_activity').insert({
        escalation_id: esc.id,
        action: 'Client Notified',
        performed_by: user?.email || 'System',
        details: 'Sent outbound notification to client'
      });

      setNotifyModalEsc(null);
      fetchActivity(esc.id);
    } catch (e) {
      console.error('Error notifying client:', e);
    }
  };

  const handleResolve = async (esc: Escalation, type: string, notes: string, notify: boolean, report: boolean) => {
    try {
      await supabase
        .from('escalations')
        .update({
          status: type === 'False Positive — No Threat' ? 'False Positive' : 'Resolved',
          resolution_type: type,
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
          client_notified: notify,
          report_generated: report,
          updated_at: new Date().toISOString()
        })
        .eq('id', esc.id);

      await supabase.from('escalation_activity').insert({
        escalation_id: esc.id,
        action: 'Resolved',
        performed_by: user?.email || 'System',
        details: `${type}: ${notes}`
      });

      if (report) {
        await supabase.from('reports').insert({
          client_id: currentClient?.id,
          title: `Incident Report — ${esc.title}`,
          type: 'incident_report',
          status: 'draft',
          alert_id: esc.alert_id,
          generated_by: user?.email || 'System'
        });
      }

      if (notify) {
        await supabase.from('escalation_communications').insert({
          escalation_id: esc.id,
          client_id: currentClient?.id,
          direction: 'outbound',
          message: `Escalation ${esc.escalation_id} has been resolved. Resolution: ${type}. Notes: ${notes}`,
          sent_by: user?.email || 'System',
          sent_at: new Date().toISOString()
        });
      }

      setResolveModalEsc(null);
      fetchActivity(esc.id);
    } catch (e) {
      console.error('Error resolving escalation:', e);
    }
  };

  const handleGenerateReportAI = async (esc: Escalation) => {
    setIsGeneratingReport(true);
    setReportContent(null);
    setShowReportViewer(true);
    setReportOptionEsc(null);
    setActiveReportEscalation(esc);

    try {
      // Get alert data for the report
      const { data: alertData } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', esc.alert_id)
        .single();

      const report = await generateStructuredSOCReport({
        type: 'Escalation',
        alertData: alertData,
        analystName: user?.email
      });

      setReportTitle(`INCIDENT REPORT: ${esc.title}`);
      setReportContent(report);
      showToast('AI Report generated successfully', 'success');
      addNotification({
        type: 'report_generated',
        title: 'AI Report Ready',
        description: `AI has successfully generated a structured SOC report for ${esc.escalation_id}.`,
        alertId: esc.alert_id
      });
    } catch (error) {
      console.error("Report generation error:", error);
      setReportContent({ executive_summary: "Error generating report. Please try again or write manually." });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleWriteReportManual = (esc: Escalation) => {
    const defaultTemplate = {
      executive_summary: "[Enter executive summary here]",
      incident_details: {
        alert_id: esc.alert_id,
        severity: esc.severity,
        timestamp: new Date().toISOString(),
        agent: esc.agent_name || "N/A",
        source_ip: "N/A"
      },
      attack_analysis: {
        description: "[Enter attack analysis here]",
        mitre_techniques: []
      },
      recommendations: {
        immediate: ["[Enter immediate action]"]
      }
    };

    setReportTitle(`INCIDENT REPORT: ${esc.title}`);
    setReportContent(defaultTemplate);
    setShowReportViewer(true);
    setReportOptionEsc(null);
    setActiveReportEscalation(esc);
  };

  const handleSaveReport = async (esc: Escalation, title: string, content: any) => {
    setIsSaving(true);
    try {
      // 1. Save to reports table (matching ReportsPage)
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: currentClient?.id,
          title: title,
          type: 'incident_report',
          content: content,
          status: 'draft',
          generated_by: user?.email,
          alert_id: esc.alert_id,
          agent_name: esc.agent_name
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Update escalation status
      const { error: escalationError } = await supabase
        .from('escalations')
        .update({ 
          report_generated: true,
          report_id: reportData.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', esc.id);

      if (escalationError) throw escalationError;

      // 3. Log activity
      await supabase.from('escalation_activity').insert({
        escalation_id: esc.id,
        action: 'Report Generated',
        details: `Professional incident report created: ${title}`,
        performed_by: user?.email || 'System'
      });

      showToast('Report saved and linked successfully', 'success');
      setShowReportViewer(false);
      fetchEscalations();
      fetchActivity(esc.id);
    } catch (error) {
      console.error("Error saving report:", error);
      showToast('Failed to save report', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEscalation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this escalation? This action cannot be undone.')) return;
    
    try {
      // 1. Delete from attack_timeline_events (via timeline_id)
      const { data: timelines } = await supabase
        .from('attack_timelines')
        .select('id')
        .eq('escalation_id', id);
      
      if (timelines && timelines.length > 0) {
        const timelineIds = timelines.map(t => t.id);
        await supabase
          .from('attack_timeline_events')
          .delete()
          .in('timeline_id', timelineIds);
        
        // 2. Delete from attack_timelines
        await supabase
          .from('attack_timelines')
          .delete()
          .in('id', timelineIds);
      }

      // 3. Delete from escalation_activity
      await supabase
        .from('escalation_activity')
        .delete()
        .eq('escalation_id', id);

      // 4. Delete from escalation_communications
      await supabase
        .from('escalation_communications')
        .delete()
        .eq('escalation_id', id);

      // 5. Delete from escalations
      const { error } = await supabase
        .from('escalations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEscalations(prev => prev.filter(e => e.id !== id));
      addNotification({
        title: 'Escalation Deleted',
        description: 'The escalation and all related data have been removed from the database.',
        type: 'agent_deleted'
      });
    } catch (error) {
      console.error('Error deleting escalation:', error);
      addNotification({
        title: 'Deletion Failed',
        description: 'Could not delete the escalation from the database. There may be linked records preventing deletion.',
        type: 'critical'
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || !supabase) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} escalation(s)? This action cannot be undone.`)) return;

    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      // 1. Delete from attack_timeline_events (via timeline_id)
      const { data: timelines } = await supabase
        .from('attack_timelines')
        .select('id')
        .in('escalation_id', ids);
      
      if (timelines && timelines.length > 0) {
        const timelineIds = timelines.map(t => t.id);
        await supabase
          .from('attack_timeline_events')
          .delete()
          .in('timeline_id', timelineIds);
        
        // 2. Delete from attack_timelines
        await supabase
          .from('attack_timelines')
          .delete()
          .in('id', timelineIds);
      }

      // 3. Delete from escalation_activity
      await supabase
        .from('escalation_activity')
        .delete()
        .in('escalation_id', ids);

      // 4. Delete from escalation_communications
      await supabase
        .from('escalation_communications')
        .delete()
        .in('escalation_id', ids);

      // 5. Delete from escalations
      const { error } = await supabase
        .from('escalations')
        .delete()
        .in('id', ids);

      if (error) throw error;

      setEscalations(prev => prev.filter(esc => !selectedIds.has(esc.id)));
      setSelectedIds(new Set());
      showToast(`Successfully deleted ${selectedIds.size} escalation(s) and related data`, 'success');
    } catch (error) {
      console.error('Error deleting escalations:', error);
      showToast('Failed to delete escalations. Some records may have dependencies.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEscalations.length && filteredEscalations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEscalations.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getSLATimer = (deadline: string | null | undefined, severity?: string, resolvedAt?: string | null, escalatedAt?: string | null) => {
    if (!deadline) return { text: 'N/A', color: 'text-neutral-600' };

    // If resolved, show time taken (duration)
    if (resolvedAt) {
      const start = escalatedAt ? new Date(escalatedAt).getTime() : new Date(deadline).getTime() - ((settings.slaLimitMinutes || 240) * 60000);
      const end = new Date(resolvedAt).getTime();
      const duration = Math.max(0, end - start);
      
      const h = Math.floor(duration / 3600000);
      const m = Math.floor((duration % 3600000) / 60000);
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      
      const isBreached = end > new Date(deadline).getTime();
      
      return { 
        text: timeStr, 
        color: isBreached ? 'text-red-500' : 'text-emerald-500',
        isBreached: isBreached
      };
    }

    const end = new Date().getTime();
    const deadlineTime = new Date(deadline).getTime();
    const timeLeft = deadlineTime - end;
    
    if (timeLeft <= 0) {
      const overdue = Math.abs(timeLeft);
      const h = Math.floor(overdue / 3600000);
      const m = Math.floor((overdue % 3600000) / 60000);
      const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

      return { 
        text: timeStr, 
        color: 'text-red-500',
        isBreached: true
      };
    }

    const hours = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return { 
      text: timeStr, 
      color: 'text-emerald-500', // Within SLA = Green
      isBreached: false 
    };
  };

  const filteredEscalations = escalations.filter(esc => {
    const matchesSearch = 
      esc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      esc.escalation_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      esc.alert_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filter === 'All' || 
      esc.priority === filter || 
      esc.status === filter;
    
    const matchesSla = !slaOnly || esc.sla_breached;

    return matchesSearch && matchesFilter && matchesSla;
  });

  const stats = {
    total: escalations.length,
    open: escalations.filter(e => ['New', 'Investigating', 'Pending'].includes(e.status)).length,
    breached: escalations.filter(e => e.sla_breached && e.status !== 'Resolved').length,
    resolvedToday: escalations.filter(e => e.status === 'Resolved' && e.resolved_at && new Date(e.resolved_at).toDateString() === new Date().toDateString()).length
  };

  const priorityCounts = {
    P1: escalations.filter(e => e.priority === 'P1' && e.status !== 'Resolved').length,
    P2: escalations.filter(e => e.priority === 'P2' && e.status !== 'Resolved').length,
    P3: escalations.filter(e => e.priority === 'P3' && e.status !== 'Resolved').length,
    P4: escalations.filter(e => e.priority === 'P4' && e.status !== 'Resolved').length,
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          <span className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Loading Escalations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-black overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
        
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-neutral-800 rounded-xl overflow-hidden bg-black">
          <StatCard label="Total Escalations" value={stats.total} sub="this week" />
          <StatCard label="Open" value={stats.open} sub="needs attention" color="text-red-500" />
          <StatCard label="SLA Breached" value={stats.breached} sub="overdue" color="text-red-500" />
          <StatCard label="Resolved Today" value={stats.resolvedToday} sub="closed today" color="text-emerald-500" />
        </div>

        {/* Priority Breakdown */}
        <div className="bg-black border border-neutral-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <PriorityPill priority="P1" label="CRITICAL" count={priorityCounts.P1} colorClass="bg-red-500/10 border-red-500/20 text-red-500" />
            <PriorityPill priority="P2" label="HIGH" count={priorityCounts.P2} colorClass="bg-orange-500/10 border-orange-500/20 text-orange-500" />
            <PriorityPill priority="P3" label="MEDIUM" count={priorityCounts.P3} colorClass="bg-blue-500/10 border-blue-500/20 text-blue-500" />
            <PriorityPill priority="P4" label="LOW" count={priorityCounts.P4} colorClass="bg-neutral-500/10 border-neutral-800 text-neutral-500" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.size})
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[10px] font-bold text-neutral-500 hover:text-white uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 group-focus-within:text-white transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search escalations, alerts, agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#111] border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 w-64 transition-all"
                  />
                </div>
                <div className="flex p-1 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                  {['All', 'P1', 'P2', 'P3', 'P4', 'New', 'Investigating', 'Resolved'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                        filter === f ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-neutral-600 font-medium">{filteredEscalations.length} escalations</span>
            <button 
              onClick={() => setSlaOnly(!slaOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                slaOnly ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
              )}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              SLA Breached Only
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className={cn(
                      "w-4 h-4 rounded border transition-all flex items-center justify-center",
                      selectedIds.size === filteredEscalations.length && filteredEscalations.length > 0
                        ? "bg-blue-600 border-blue-600" 
                        : "border-neutral-700 hover:border-neutral-500"
                    )}
                  >
                    {selectedIds.size === filteredEscalations.length && filteredEscalations.length > 0 && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">ESC ID</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Priority</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Title / Alert</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Client / Agent</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Assigned To</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">SLA Timer</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Status</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredEscalations.map(esc => {
                const isExpanded = expandedId === esc.id;
                const isSelected = selectedIds.has(esc.id);
                const sla = getSLATimer(esc.sla_deadline, esc.severity, esc.resolved_at, esc.escalated_at);
                
                return (
                  <React.Fragment key={esc.id}>
                    <tr 
                      onClick={() => {
                        const newId = isExpanded ? null : esc.id;
                        setExpandedId(newId);
                        if (newId) fetchActivity(newId);
                      }}
                      className={cn(
                        "transition-all cursor-pointer group",
                        isExpanded ? "bg-white/[0.04] border-l-2 border-l-red-500" : "hover:bg-white/[0.03]",
                        isSelected && "bg-blue-500/5"
                      )}
                    >
                      <td className="p-4">
                        <button 
                          onClick={(e) => toggleSelect(esc.id, e)}
                          className={cn(
                            "w-4 h-4 rounded border transition-all flex items-center justify-center",
                            isSelected ? "bg-blue-600 border-blue-600" : "border-neutral-700 group-hover:border-neutral-500"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </td>
                      <td className="p-4 font-mono text-neutral-400 text-[12px]">{esc.escalation_id}</td>
                      <td className="p-4">
                        {esc.priority === 'P1' && <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">P1 Critical</span>}
                        {esc.priority === 'P2' && <span className="border border-orange-500/50 text-orange-500 font-bold text-[10px] px-2 py-0.5 rounded uppercase">P2 High</span>}
                        {esc.priority === 'P3' && <span className="border border-blue-500/50 text-blue-500 font-bold text-[10px] px-2 py-0.5 rounded uppercase">P3 Medium</span>}
                        {esc.priority === 'P4' && <span className="border border-neutral-700 text-neutral-500 font-bold text-[10px] px-2 py-0.5 rounded uppercase">P4 Low</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-white font-medium text-[12px]">{esc.title}</span>
                          <span className="text-neutral-500 text-[10px] mt-0.5">{esc.alert_id}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <SeverityBadge severity={esc.severity} />
                          <span className="text-[11px] text-neutral-400">Endpoint Agent</span>
                        </div>
                      </td>
                      <td className="p-4 text-[11px] text-neutral-400">
                        {esc.assigned_to ? <span className="truncate max-w-[120px] block">{esc.assigned_to}</span> : <span className="italic text-neutral-600">Unassigned</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-bold", sla.color)}>
                            {sla.isBreached ? (
                              <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[9px] border border-red-500/20">
                                <AlertCircle className="w-3 h-3" />
                                {sla.text}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                {esc.status !== 'Resolved' && <Clock className="w-3 h-3 opacity-50" />}
                                {sla.text}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusPill status={esc.status} />
                      </td>
                      <td className="p-4">
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                          <ChevronDown className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" />
                        </motion.div>
                      </td>
                    </tr>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0 border-b border-neutral-800">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-black/40"
                            >
                              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                                {/* Left Column */}
                                <div className="space-y-8">
                                  <div>
                                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-6">Escalation Details</h5>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                      {[
                                        { label: 'Escalation ID', value: esc.escalation_id },
                                        { label: 'Priority', value: esc.priority, isBadge: true },
                                        { label: 'Status', value: esc.status, isPill: true },
                                        { label: 'Escalated By', value: esc.escalated_by },
                                        { label: 'Escalated At', value: new Date(esc.escalated_at).toLocaleString() },
                                        { label: 'Alert ID', value: esc.alert_id, isLink: true },
                                        { label: 'Severity', value: esc.severity, isSev: true },
                                        { label: 'SLA Deadline', value: new Date(esc.sla_deadline).toLocaleString() },
                                      ].map(item => (
                                        <div key={item.label} className="flex flex-col gap-1.5">
                                          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{item.label}</span>
                                          {item.isBadge ? (
                                            <div className="flex">
                                              {esc.priority === 'P1' && <span className="bg-red-500 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase">P1 Critical</span>}
                                              {esc.priority === 'P2' && <span className="border border-orange-500/50 text-orange-500 font-bold text-[9px] px-2 py-0.5 rounded uppercase">P2 High</span>}
                                              {esc.priority === 'P3' && <span className="border border-blue-500/50 text-blue-500 font-bold text-[9px] px-2 py-0.5 rounded uppercase">P3 Medium</span>}
                                              {esc.priority === 'P4' && <span className="border border-neutral-700 text-neutral-500 font-bold text-[9px] px-2 py-0.5 rounded uppercase">P4 Low</span>}
                                            </div>
                                          ) : item.isPill ? (
                                            <StatusPill status={esc.status} />
                                          ) : item.isSev ? (
                                            <SeverityBadge severity={esc.severity} />
                                          ) : item.isLink ? (
                                            <button className="text-blue-400 hover:text-blue-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors">
                                              {item.value} <ExternalLink className="w-3 h-3" />
                                            </button>
                                          ) : (
                                            <span className="text-[11px] text-neutral-300 font-medium">{item.value}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Investigation Notes</h5>
                                    <textarea 
                                      placeholder="Add investigation notes..."
                                      defaultValue={esc.investigation_notes}
                                      onBlur={(e) => handleUpdateNotes(esc.id, e.target.value)}
                                      className="w-full bg-[#111] border border-neutral-800 rounded-lg px-4 py-3 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none h-24 transition-all"
                                    />
                                  </div>

                                  <div>
                                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-6">Activity Log</h5>
                                    <div className="space-y-6 relative before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-800">
                                      {(activityLogs[esc.id] || []).map(act => (
                                        <div key={act.id} className="relative pl-6">
                                          <div className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full bg-black border-2 border-neutral-800 flex items-center justify-center">
                                            <div className="w-1 h-1 rounded-full bg-blue-500" />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <span className="text-white text-[12px] font-medium">{act.action}</span>
                                            <span className="text-neutral-500 text-[11px] leading-relaxed">{act.details}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest">{act.performed_by}</span>
                                              <span className="text-neutral-700 text-[10px]">•</span>
                                              <span className="text-neutral-600 text-[10px]">{new Date(act.created_at).toLocaleString()}</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-8">
                                  <div>
                                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Assignment</h5>
                                    <div className="space-y-3">
                                      <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 group-focus-within:text-white transition-colors" />
                                        <input 
                                          type="text"
                                          placeholder="Assign to analyst email..."
                                          defaultValue={esc.assigned_to}
                                          onBlur={(e) => handleUpdateAssignment(esc.id, e.target.value)}
                                          className="w-full bg-[#111] border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                        />
                                      </div>
                                      <p className="text-[10px] text-neutral-600 italic">Assigning multiple escalations to one analyst may impact SLA performance.</p>
                                    </div>
                                  </div>

                                  <div>
                                    <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Actions</h5>
                                    <div className="grid grid-cols-1 gap-3">
                                      <button 
                                        onClick={() => setAiEscalation(esc)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 hover:bg-red-500/10 transition-all group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Bot className="w-4 h-4" />
                                          <span className="text-[11px] font-bold uppercase tracking-widest">Open AI Assistant</span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />
                                      </button>

                                      <button 
                                        onClick={() => buildAttackTimeline(esc)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/5 border border-purple-500/10 rounded-xl text-purple-400 hover:bg-purple-500/10 transition-all group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <GitBranch className="w-4 h-4" />
                                          <span className="text-[11px] font-bold uppercase tracking-widest">View Attack Timeline</span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />
                                      </button>
                                      
                                      <button 
                                        onClick={() => handleOpenInvestigationWorkspace(esc)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all group"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Search className="w-4 h-4" />
                                          <span className="text-[11px] font-bold uppercase tracking-widest">
                                            {esc.status === 'Resolved' || esc.status === 'False Positive' 
                                              ? "Review Investigation" 
                                              : activeWorkspaces[esc.id] ? "View Investigation" : "Create Case & Investigate"}
                                          </span>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />
                                      </button>

                                      <button 
                                        disabled={esc.report_generated}
                                        onClick={() => {
                                          setAutoOpenReportAfterTimeline(true);
                                          buildAttackTimeline(esc);
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all group",
                                          esc.report_generated ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500 opacity-50" : "bg-white/[0.02] border-neutral-800 text-neutral-400 hover:bg-white/[0.05] hover:text-white"
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <FileText className="w-4 h-4" />
                                          <span className="text-[11px] font-bold uppercase tracking-widest">Generate Report</span>
                                        </div>
                                        {esc.report_generated ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />}
                                      </button>

                                      <button 
                                        onClick={() => setNotifyModalEsc(esc)}
                                        className={cn(
                                          "w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all group",
                                          esc.client_notified ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : "bg-white/[0.02] border-neutral-800 text-neutral-400 hover:bg-white/[0.05] hover:text-white"
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Mail className="w-4 h-4" />
                                          <span className="text-[11px] font-bold uppercase tracking-widest">Notify Client</span>
                                        </div>
                                        {esc.client_notified ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all" />}
                                      </button>
                                    </div>
                                  </div>

                                  {esc.status !== 'Resolved' && (
                                    <div className="pt-4">
                                      <button 
                                        onClick={() => setResolveModalEsc(esc)}
                                        className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all rounded-xl font-bold uppercase tracking-widest text-[11px]"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                        Resolve Escalation
                                      </button>
                                    </div>
                                  )}

                                  <div className="pt-2">
                                    <button 
                                      onClick={() => handleDeleteEscalation(esc.id)}
                                      className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-xl font-bold uppercase tracking-widest text-[11px]"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete Escalation
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {filteredEscalations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-neutral-800/20 blur-3xl rounded-full" />
                <Shield className="w-16 h-16 text-neutral-800 relative" />
              </div>
              <h3 className="text-neutral-500 font-bold text-sm uppercase tracking-widest mb-2">
                {escalations.length === 0 ? "No escalations yet" : "No matches found"}
              </h3>
              <p className="text-neutral-600 text-[11px] max-w-[200px]">
                {escalations.length === 0 ? "Escalated alerts will appear here for investigation." : "Try adjusting your filters or search query."}
              </p>
            </div>
          )}
        </div>
      </div>

      {showWorkspace && activeWorkspace && activeWorkspaceEsc && (
        <InvestigationWorkspace 
          esc={activeWorkspaceEsc}
          workspace={activeWorkspace}
          data={workspaceData}
          loading={workspaceLoading}
          onClose={() => setShowWorkspace(false)}
          onRunThreatIntel={handleRunThreatIntel}
          onAddAlertAsEvidence={handleAddAlertAsEvidence}
          onAddNote={handleAddNote}
          onToggleKeyFinding={handleToggleKeyFinding}
          onAddEvidence={handleAddEvidence}
          onChecklistUpdate={handleChecklist}
          onAddChecklistItem={handleAddChecklistItem}
          onRemoveChecklistItem={handleRemoveChecklistItem}
          onGenerateReport={handleGenerateWorkspaceReport}
          onBlockIP={handleBlockIP}
          onAddCurrentFindingsAsEvidence={handleAddCurrentFindingsAsEvidence}
          onShowVerdict={() => setShowVerdictModal(true)}
        />
      )}

      <AnimatePresence>
        {showVerdictModal && activeWorkspace && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-neutral-800 rounded-[2rem] w-full max-w-lg overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] relative"
            >
              <div className="p-6 border-b border-neutral-800/80 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-800">
                    <ShieldAlert className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-black text-white uppercase tracking-widest">Resolution Verdict</h3>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">IR-{activeWorkspaceEsc?.escalation_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowVerdictModal(false);
                    setSelectedVerdictId(null);
                  }} 
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg transition-all"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Compact Grid */}
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'True Positive', label: 'True Positive', icon: ShieldAlert, activeClass: 'bg-[#ff3b3b] text-white border-[#ff3b3b] shadow-[0_8px_25px_rgba(255,59,59,0.3)] scale-[1.02]', baseClass: 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-red-500/30' },
                    { id: 'False Positive', label: 'False Positive', icon: ShieldCheck, activeClass: 'bg-[#10b981] text-white border-[#10b981] shadow-[0_8px_25px_rgba(16,185,129,0.3)] scale-[1.02]', baseClass: 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-emerald-500/30' },
                    { id: 'Benign', label: 'Benign', icon: Shield, activeClass: 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-[0_8px_25px_rgba(59,130,246,0.3)] scale-[1.02]', baseClass: 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-blue-500/30' },
                  ].map(v => (
                    <button 
                      key={v.id}
                      onClick={() => setSelectedVerdictId(v.id)}
                      className={cn(
                        "group relative flex items-center gap-4 px-6 py-4 rounded-[1.25rem] border transition-all duration-300 w-full",
                        selectedVerdictId === v.id 
                          ? v.activeClass
                          : v.baseClass
                      )}
                    >
                       <div className={cn(
                         "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all",
                         selectedVerdictId === v.id 
                          ? "bg-white/20 border-white/40" 
                          : "bg-black/40 border-neutral-800 group-hover:border-neutral-700"
                       )}>
                          {selectedVerdictId === v.id ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : (
                            <v.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                          )}
                       </div>
                       <span className="text-[13px] font-black uppercase tracking-[0.1em]">{v.label}</span>
                       
                       {selectedVerdictId === v.id && (
                         <div className="absolute right-6 opacity-40">
                            <motion.div initial={{ x: -5 }} animate={{ x: 0 }}>
                              <CheckCircle2 className="w-5 h-5" />
                            </motion.div>
                         </div>
                       )}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Justification</label>
                    <textarea 
                      value={verdictReason}
                      onChange={(e) => setVerdictReason(e.target.value)}
                      placeholder="Conclusion logic..."
                      className="w-full bg-neutral-900/30 border border-neutral-800 rounded-xl px-4 py-3 text-[12px] text-neutral-300 focus:outline-none focus:border-neutral-700 transition-all h-24 resize-none leading-relaxed font-medium"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[9px] font-black text-neutral-600 uppercase tracking-widest">
                       <span>Confidence</span>
                       <span className="text-white">{verdictConfidence}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={verdictConfidence}
                      onChange={(e) => setVerdictConfidence(parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
                </div>

                <button
                  disabled={!selectedVerdictId || !verdictReason.trim()}
                  onClick={() => {
                    if (selectedVerdictId) {
                      handleWorkspaceVerdict(selectedVerdictId, verdictReason, verdictConfidence);
                      setSelectedVerdictId(null);
                    }
                  }}
                  className={cn(
                    "w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border flex items-center justify-center gap-3",
                    selectedVerdictId && verdictReason.trim()
                      ? "bg-white text-black border-white shadow-[0_10px_20px_rgba(255,255,255,0.05)] hover:scale-[1.01]"
                      : "bg-neutral-800/50 text-neutral-600 border-neutral-800 cursor-not-allowed opacity-30"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Finalize Resolution
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals & Panels */}
      <AnimatePresence>
        {aiEscalation && (
          <AIAssistant 
            escalation={aiEscalation} 
            onClose={() => setAiEscalation(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTimeline && activeTimelineEscalation && (
          <AttackTimelinePanel 
            escalation={activeTimelineEscalation}
            onClose={() => setShowTimeline(false)}
            loading={timelineLoading}
            timeline={currentTimeline}
            events={timelineEvents}
            loadingStep={loadingStep}
            onGenerateReport={(esc) => setReportOptionEsc(esc)}
            onNotifyClient={(esc) => setNotifyModalEsc(esc)}
            onSelectEvent={setSelectedAlertEvent}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resolveModalEsc && (
          <ResolveModal 
            isOpen={!!resolveModalEsc} 
            onClose={() => setResolveModalEsc(null)} 
            onConfirm={(type, notes, notify, report) => handleResolve(resolveModalEsc, type, notes, notify, report)}
            escalation={resolveModalEsc}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notifyModalEsc && (
          <NotifyModal 
            isOpen={!!notifyModalEsc} 
            onClose={() => setNotifyModalEsc(null)} 
            onConfirm={(msg) => handleNotifyClient(notifyModalEsc, msg)}
            escalation={notifyModalEsc}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {linkedAlertsEsc && (
          <LinkedAlertsModal 
            isOpen={!!linkedAlertsEsc}
            onClose={() => setLinkedAlertsEsc(null)}
            escalation={linkedAlertsEsc}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportOptionEsc && (
          <ReportOptionModal 
            isOpen={!!reportOptionEsc}
            onClose={() => setReportOptionEsc(null)}
            onSelect={(mode) => mode === 'ai' ? handleGenerateReportAI(reportOptionEsc) : handleWriteReportManual(reportOptionEsc)}
            escalation={reportOptionEsc}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAlertEvent && (
          <AlertDetailsModal 
            isOpen={!!selectedAlertEvent}
            onClose={() => setSelectedAlertEvent(null)}
            event={selectedAlertEvent}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReportViewer && activeReportEscalation && (
          <ReportViewerPanel 
            escalation={activeReportEscalation}
            onClose={() => setShowReportViewer(false)}
            reportContent={reportContent}
            reportTitle={reportTitle}
            onSave={(title, content) => handleSaveReport(activeReportEscalation, title, content)}
            isSaving={isSaving}
            isGenerating={isGeneratingReport}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
