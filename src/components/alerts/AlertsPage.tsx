import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  AlertTriangle,
  ShieldAlert, 
  Globe, 
  Terminal, 
  MessageSquare, 
  Send, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  FileText,
  ShieldCheck,
  Zap,
  Shield,
  User,
  Bot,
  Clock,
  X,
  CheckSquare,
  Square,
  MoreVertical,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Search,
  Calendar,
  Loader2,
  Monitor,
  Tag,
  Layers,
  Play,
  Settings2,
  Trash2,
  Power,
  Download,
  Check
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn, getSeverityFromLevel } from '../../lib/utils';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import { LogViewer } from '../ui/LogViewer';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { generateStructuredSOCReport, generateAINarrative } from '../../lib/gemini';
import { downloadIncidentReport } from '../../utils/reportExporter';

// --- Types ---

interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  description: string;
  source_ip: string;
  dest_ip: string;
  rule_id: string;
  agent_name?: string;
  rule_level?: number;
  threat_intel?: {
    reputation: string;
    malicious: boolean;
    details: string;
    provider: string;
  };
  raw_log: any;
  client_id: string;
  wazuh_group?: string;
  resolution_notes?: string;
  resolution_type?: string;
  closed_at?: string;
  closed_by?: string;
  case_id?: string;
  cases?: {
    title: string;
  };
  has_report?: boolean;
}

interface AlertGroup {
  id: string;
  client_id: string;
  rule_id: string;
  rule_description: string;
  severity: string;
  alert_count: number;
  first_seen: string;
  last_seen: string;
  latest_alert_id: string;
  latest_source_ip: string;
  latest_agent_name: string;
  status: string;
  auto_action?: string;
  resolution_type?: string;
  resolution_notes?: string;
  closed_by?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

interface AlertPlaybook {
  id: string;
  client_id: string;
  rule_id: string;
  rule_description: string;
  auto_action: string;
  resolution_type: string;
  resolution_notes: string;
  created_by: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Helpers ---

const isUUID = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// --- Merge to Case Modal ---

const MergeToCaseModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedCount 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (caseId: string, isNew: boolean, caseTitle: string) => void;
  selectedCount: number;
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [caseId, setCaseId] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [existingCases, setExistingCases] = useState<{id: string, title: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'existing') {
      fetchCases();
    }
  }, [isOpen, mode]);

  const fetchCases = async () => {
    if (!supabase) return;
    setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, title')
        .neq('status', 'Closed')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching cases:', error);
        setFetchError(error.message);
        // If the table doesn't exist, we should probably inform the user or handle it
        if (error.code === 'PGRST116' || error.message.includes('relation "cases" does not exist')) {
           console.warn('Cases table might be missing.');
        }
      } else if (data) {
        setExistingCases(data);
      }
    } catch (e) {
      console.error('Error fetching cases:', e);
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Merge to Case</h3>
              <p className="text-xs text-neutral-500">Merging {selectedCount} selected alerts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex p-1 bg-black rounded-xl border border-neutral-800">
            <button 
              onClick={() => setMode('existing')}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                mode === 'existing' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              EXISTING CASE
            </button>
            <button 
              onClick={() => setMode('new')}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                mode === 'new' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              NEW CASE
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Select Case</label>
              <select 
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="">Choose a case...</option>
                {existingCases.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {loading && <p className="text-[10px] text-blue-500 animate-pulse">Loading cases...</p>}
              {fetchError && (
                <div className="p-2 bg-red-500/10 border border-red-500/50 rounded text-[10px] text-red-500">
                  Failed to load cases. Please ensure the backend is properly configured or contact support.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Title</label>
              <input 
                type="text"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                placeholder="e.g., Brute Force Investigation"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="p-6 bg-black/40 flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
          >
            CANCEL
          </button>
          <button 
            disabled={mode === 'existing' ? !caseId : !caseTitle}
            onClick={() => onConfirm(caseId, mode === 'new', caseTitle)}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
          >
            CONFIRM MERGE
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AIAssistant = ({ alert }: { alert: SecurityAlert }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const systemInstruction = "You are a cybersecurity expert assistant. You are helping an analyst investigate a security alert.";
      const prompt = `ALERT CONTEXT:
      ID: ${alert.id}
      Description: ${alert.description}
      Severity: ${alert.severity}
      Source IP: ${alert.source_ip}
      Destination IP: ${alert.dest_ip}
      Rule: ${alert.rule_id}
      Threat Intel: ${alert.threat_intel?.details || 'N/A'}
      Raw Log: ${JSON.stringify(alert.raw_log)}
      
      User Question: ${input}`;

      const result = await generateAINarrative(prompt, systemInstruction);
      
      const assistantMessage = { 
        role: 'assistant' as const, 
        content: result.response || result.details || result.text || result.result || (typeof result === 'string' ? result : "I'm sorry, I couldn't process that request.")
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error: Failed to connect to the AI service. Please check your API key." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900 flex items-center gap-2">
        <Bot className="w-4 h-4 text-blue-500" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">AI Analyst Assistant</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex gap-3",
            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
          )}>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-blue-500/10" : "bg-purple-500/10"
            )}>
              {msg.role === 'user' ? <User className="w-3 h-3 text-blue-500" /> : <Bot className="w-3 h-3 text-purple-500" />}
            </div>
            <div className={cn(
              "max-w-[80%] p-3 rounded-2xl text-[11px] leading-relaxed",
              msg.role === 'user' ? "bg-blue-500/10 text-blue-100" : "bg-neutral-800 text-neutral-300"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Bot className="w-3 h-3 text-purple-500" />
            </div>
            <div className="bg-neutral-800 p-3 rounded-2xl">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI about this alert..."
            className="w-full bg-black border border-neutral-800 rounded-xl pl-4 pr-10 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-3 h-3 text-blue-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

const CloseGroupModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  group 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (resolutionType: string, resolutionNotes: string, createPlaybook: boolean) => void;
  group: AlertGroup | null;
}) => {
  const [resolutionType, setResolutionType] = useState('True Positive');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [createPlaybook, setCreatePlaybook] = useState(false);

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Close Alert Group</h3>
              <p className="text-xs text-neutral-500 truncate max-w-[200px]">{group.rule_description}</p>
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
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
            >
              <option value="True Positive">True Positive</option>
              <option value="False Positive">False Positive</option>
              <option value="Benign">Benign</option>
              <option value="Duplicate">Duplicate</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Resolution Notes</label>
            <textarea 
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Provide details about why this group is being closed..."
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <button 
              onClick={() => setCreatePlaybook(!createPlaybook)}
              className={cn(
                "w-5 h-5 rounded border transition-all flex items-center justify-center",
                createPlaybook ? "bg-purple-600 border-purple-500" : "border-neutral-700 bg-black"
              )}
            >
              {createPlaybook && <CheckCircle2 className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1">
              <p className="text-xs font-bold text-purple-400">Create Auto-Playbook</p>
              <p className="text-[10px] text-neutral-500">Automatically close future alerts with this rule ID</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/40 flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
          >
            CANCEL
          </button>
          <button 
            onClick={() => onConfirm(resolutionType, resolutionNotes, createPlaybook)}
            className="flex-1 py-3 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-all shadow-lg shadow-red-600/20"
          >
            CLOSE GROUP
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PlaybookCard = ({ 
  playbook, 
  onToggle, 
  onDelete 
}: { 
  playbook: AlertPlaybook; 
  onToggle: () => void; 
  onDelete: () => void;
}) => {
  return (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl p-4 flex items-center justify-between hover:border-neutral-700 transition-all">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          playbook.active ? "bg-purple-500/10 text-purple-500" : "bg-neutral-800 text-neutral-500"
        )}>
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">{playbook.rule_description}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Rule ID: {playbook.rule_id}</span>
            <div className="w-[1px] h-2.5 bg-neutral-800" />
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Action: {playbook.auto_action}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={onToggle}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
            playbook.active 
              ? "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white" 
              : "bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-white"
          )}
        >
          <Power className="w-3 h-3" />
          {playbook.active ? 'ENABLED' : 'DISABLED'}
        </button>
        <button 
          onClick={onDelete}
          className="p-2 hover:bg-red-500/10 hover:text-red-500 text-neutral-500 rounded-lg transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
const GroupCard = ({ 
  group, 
  playbook,
  onExpand, 
  onClose, 
  onEscalate,
  onPlaybook,
  onViewAlerts,
  onSelectAlert
}: { 
  group: AlertGroup; 
  playbook?: AlertPlaybook;
  onExpand: () => void; 
  onClose: () => void;
  onEscalate: () => void;
  onPlaybook: () => void;
  onViewAlerts?: (ruleDescription: string) => void;
  onSelectAlert: (alert: SecurityAlert) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [groupAlerts, setGroupAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (group.status === 'Closed' && isExpanded) {
      fetchGroupAlerts();
    }
  }, [group.status]);

  const toggleExpand = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded && groupAlerts.length === 0) {
      fetchGroupAlerts();
    }
  };

  const fetchGroupAlerts = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', group.client_id)
        .eq('rule_id', group.rule_id)
        .order('timestamp', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setGroupAlerts(data || []);
    } catch (e) {
      console.error('Error fetching group alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  const severityColor = {
    'CRITICAL': 'bg-red-500',
    'HIGH': 'bg-orange-500',
    'MEDIUM': 'bg-blue-500',
    'LOW': 'bg-neutral-500'
  }[group.severity.toUpperCase()] || 'bg-neutral-500';

  return (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-xl overflow-hidden transition-all hover:border-neutral-700">
      <div 
        className="flex items-stretch cursor-pointer group/card"
        onClick={() => toggleExpand()}
      >
        <div className={cn("w-1.5", severityColor)} />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-bold text-white tracking-tight group-hover/card:text-blue-400 transition-colors">{group.rule_description}</h4>
              {playbook && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                  <Zap className="w-2.5 h-2.5 text-purple-400" />
                  <span className="text-[9px] font-bold text-purple-400 uppercase tracking-tighter">Auto-Playbook Active</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-bold text-neutral-400">x{group.alert_count}</span>
              <button 
                onClick={(e) => toggleExpand(e)}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Last Seen</p>
              <p className="text-[11px] text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-neutral-500" />
                {new Date(group.last_seen).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Latest Source</p>
              <p className="text-[11px] text-neutral-300 flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-neutral-500" />
                {group.latest_source_ip}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Latest Agent</p>
              <p className="text-[11px] text-neutral-300 flex items-center gap-1.5">
                <Monitor className="w-3 h-3 text-neutral-500" />
                {group.latest_agent_name}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Status</p>
              <StatusPill status={group.status === 'Closed' ? (group.resolution_type || 'Closed') : group.status} />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-neutral-800/50">
            <button 
              onClick={(e) => { e.stopPropagation(); onViewAlerts?.(group.rule_description); }}
              className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white text-[10px] font-bold rounded transition-all"
            >
              VIEW ALL ALERTS
            </button>
            {group.status === 'Active' && (
              <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white text-[10px] font-bold rounded transition-all"
              >
                CLOSE GROUP
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onEscalate(); }}
              className="px-4 py-2 bg-black border border-neutral-800 hover:border-white hover:bg-white/5 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 uppercase tracking-[0.2em]"
            >
              {group.status === 'Escalated' ? 'VIEW ESCALATION' : 'ESCALATE'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onPlaybook(); }}
              className="px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600 text-purple-500 hover:text-white text-[10px] font-bold rounded transition-all"
            >
              CREATE PLAYBOOK
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-neutral-800 bg-black/40"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Grouped Alerts (Last 50)</h5>
                {loading && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                {groupAlerts.map((alert, idx) => (
                  <div 
                    key={alert.id}
                    onClick={() => onSelectAlert(alert)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group/item",
                      idx === 0 ? "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40" : "bg-neutral-900/30 border-neutral-800 hover:border-neutral-700"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500">{new Date(alert.timestamp).toLocaleString()}</p>
                        <p className="text-xs font-medium text-white group-hover/item:text-blue-400 transition-colors">{alert.source_ip}</p>
                      </div>
                      <div className="w-[1px] h-6 bg-neutral-800" />
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-neutral-500">Agent</p>
                        <p className="text-xs font-medium text-white">{alert.agent_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={alert.status === 'Closed' ? (alert.resolution_type || 'Closed') : alert.status} />
                      <button className="p-1.5 hover:bg-white/5 rounded transition-colors text-neutral-500 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {!loading && groupAlerts.length === 0 && (
                  <p className="text-center py-8 text-xs text-neutral-500">No individual alerts found.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
// --- Close Alert Modal ---

const CloseAlertModal = ({ alert, onClose, onConfirm }: { alert: SecurityAlert, onClose: () => void, onConfirm: (comment: string, resolution: string) => void }) => {
  const [comment, setComment] = useState('');
  const [resolution, setResolution] = useState('True Positive');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Close Alert</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Resolution Type</label>
            <select 
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="True Positive">True Positive</option>
              <option value="False Positive">False Positive</option>
              <option value="Benign Positive">Benign Positive</option>
              <option value="Testing">Testing</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Comment / Notes</label>
            <textarea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain why this alert is being closed..."
              className="w-full bg-black border border-neutral-800 rounded-md px-3 py-2 text-sm text-white h-24 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
            />
          </div>
        </div>
        
        <div className="px-6 py-4 bg-black/40 border-t border-neutral-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(comment, resolution)}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold rounded-md transition-colors"
          >
            Close Alert
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Alert Row Component ---

const EscalationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  alert,
  isGenerating
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (priority: string, assignedTo: string, notes: string, action: 'escalate' | 'report') => void;
  alert: SecurityAlert;
  isGenerating: boolean;
}) => {
  const [priority, setPriority] = useState(`P${alert.severity === 'CRITICAL' ? '1' : alert.severity === 'HIGH' ? '2' : alert.severity === 'MEDIUM' ? '3' : '4'}`);
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Escalate Alert</h3>
              <p className="text-xs text-neutral-500">This will create an incident report for this alert</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Alert Summary */}
          <div className="p-4 bg-black/40 rounded-xl border border-neutral-800 space-y-3">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Alert ID</span>
                <span className="text-[11px] font-mono text-white">{alert.id}</span>
             </div>
             <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Description</span>
                <span className="text-[12px] text-white font-medium">{alert.description}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity</span>
                <SeverityBadge severity={alert.severity} />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Agent</span>
                <span className="text-[11px] text-white">{alert.agent_name || 'N/A'}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Timestamp</span>
                <span className="text-[11px] text-white">{alert.timestamp}</span>
             </div>
             {alert.source_ip && (
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source IP</span>
                  <span className="text-[11px] font-mono text-white">{alert.source_ip}</span>
               </div>
             )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Escalation Priority</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Assign To</label>
              <input 
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Analyst email or name"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Escalation Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional context for the report..."
                rows={3}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/40 flex items-center gap-3">
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-xl text-[10px] font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 uppercase tracking-widest"
          >
            CANCEL
          </button>
          <button 
            onClick={() => onConfirm(priority, assignedTo, notes, 'escalate')}
            disabled={isGenerating}
            className="flex-1 py-3 bg-black border border-neutral-800 hover:border-white hover:bg-white/5 text-white text-[10px] font-bold rounded-xl transition-all active:scale-95 uppercase tracking-[0.2em] disabled:opacity-50"
          >
            ESCALATE
          </button>
          <button 
            onClick={() => onConfirm(priority, assignedTo, notes, 'report')}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-xl text-[10px] font-bold bg-white text-black hover:bg-neutral-200 transition-all disabled:opacity-50 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                GENERATING...
              </>
            ) : (
              'GENERATE REPORT'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EscalationSuccessModal = ({ 
  isOpen, 
  onClose, 
  report, 
  clientName 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  report: any; 
  clientName: string;
}) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Escalation Successful</h3>
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              The incident report has been generated and saved to your history.
            </p>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => downloadIncidentReport(report, clientName)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Download className="w-4 h-4" /> Download Word Report
            </button>
            <button 
              onClick={onClose}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest"
            >
              View Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AlertRow = ({ 
  alert, 
  isSelected, 
  onSelect, 
  onStatusChange,
  sharedIntel,
  onIntelUpdate,
  onEscalate,
  isFirst = false
}: { 
  alert: SecurityAlert, 
  isSelected: boolean, 
  onSelect: () => void,
  onStatusChange: (newStatus: string) => void,
  sharedIntel?: SecurityAlert['threat_intel'],
  onIntelUpdate?: (intel: SecurityAlert['threat_intel']) => void,
  onEscalate?: (alert: SecurityAlert) => void,
  isFirst?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [logViewMode, setLogViewMode] = useState<'raw' | 'table'>('raw');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const getBestIntel = () => {
    if (sharedIntel && sharedIntel.reputation !== 'Unknown' && sharedIntel.reputation !== 'Error') return sharedIntel;
    if (alert.threat_intel && alert.threat_intel.reputation !== 'Unknown' && alert.threat_intel.reputation !== 'Error') return alert.threat_intel;
    return sharedIntel || alert.threat_intel || null;
  };

  const [intel, setIntel] = useState<SecurityAlert['threat_intel'] | null>(getBestIntel());
  const [isFetchingIntel, setIsFetchingIntel] = useState(false);
  const [showIntel, setShowIntel] = useState(() => {
    const best = getBestIntel();
    return !!(best && best.reputation !== 'Unknown' && best.reputation !== 'Error');
  });

  useEffect(() => {
    const best = getBestIntel();
    if (best) {
      setIntel(best);
      if (best.reputation !== 'Unknown' && best.reputation !== 'Error') {
        setShowIntel(true);
      }
    }
  }, [sharedIntel, alert.threat_intel]);

  useEffect(() => {
    if (isSelected && isExpanded) {
      setIsExpanded(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isExpanded && timelineEvents.length === 0) {
      fetchTimeline();
    }
    // Re-check cache on expansion if we don't have definitive intel yet
    if (isExpanded && (!intel || intel.reputation === 'Unknown' || intel.reputation === 'Error')) {
      fetchThreatIntel(true);
    } else if (isExpanded && intel && intel.reputation !== 'Unknown' && intel.reputation !== 'Error') {
      setShowIntel(true);
    }
  }, [isExpanded]);

  useEffect(() => {
    // Auto-check cache on mount
    fetchThreatIntel(true);
  }, []);

  const fetchThreatIntel = async (cacheOnly = false, forceRefresh = false) => {
    if (!alert.source_ip || alert.source_ip === 'N/A' || alert.source_ip === '0.0.0.0') return;
    if (!cacheOnly) setIsFetchingIntel(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // First, try the real API via our server proxy
      const queryParams = new URLSearchParams();
      if (cacheOnly) queryParams.append('cacheOnly', 'true');
      if (forceRefresh) queryParams.append('refresh', 'true');
      
      const apiResponse = await fetch(`/api/threat-intel/ip/${encodeURIComponent(alert.source_ip)}?${queryParams.toString()}`, {
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        }
      });
      
      let apiResult: any = null;
      const contentType = apiResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          apiResult = await apiResponse.json();
        } catch (e) {
          console.warn('Failed to parse JSON from threat intel API:', e);
        }
      } else {
        const text = await apiResponse.text();
        console.warn('Threat intel API returned non-JSON response:', text.substring(0, 100));
        if (apiResponse.status === 404 && text.includes('<!DOCTYPE')) {
          setFetchError("Backend API unavailable. Please use a full-stack platform like Cloud Run to run the Express server.");
        }
      }

      if (apiResponse.ok && apiResult && apiResult.reputation !== 'Error' && apiResult.reputation !== 'Unknown') {
        const newIntel = {
          reputation: apiResult.reputation,
          malicious: apiResult.malicious,
          details: apiResult.details,
          provider: apiResult.provider
        };
        setIntel(newIntel);
        setShowIntel(true);
        if (onIntelUpdate) onIntelUpdate(newIntel);
        if (!cacheOnly) setIsFetchingIntel(false);
        return;
      }

      // If cacheOnly is true, we don't proceed to AI fallback
      if (cacheOnly) return;

      // If API fails or is not configured, fallback to our secure Gemini SDK
      const systemInstruction = "Perform a real-time threat intelligence lookup for security indicators.";
      const prompt = `Indicator Analysis:
      Source IP: ${alert.source_ip}
      Alert Context: ${alert.description}
      
      Search for this IP on threat intelligence platforms. 
      Determine if the IP is known for malicious activity, its reputation, and any associated threat actors.
      
      CRITICAL ACCURACY RULES:
      - If NO clear evidence of malicious activity, return reputation: "Clean" and malicious: false.
      - Do NOT flag public cloud IPs as malicious unless confirmed.
      - Return JSON format: reputation, malicious, details, provider.`;

      const result = await generateAINarrative(prompt, systemInstruction);
      
      const aiIntel = {
        reputation: result.reputation || 'Unknown',
        malicious: !!result.malicious,
        details: result.details || 'No specific details found in search results.',
        provider: result.provider || 'Gemini AI'
      };
      setIntel(aiIntel);
      if (aiIntel.reputation !== 'Unknown' && aiIntel.reputation !== 'Error') {
        setShowIntel(true);
      }
      if (onIntelUpdate) onIntelUpdate(aiIntel);
    } catch (error) {
      console.error("Error fetching threat intel:", error);
      const errorIntel = {
        reputation: 'Error',
        malicious: false,
        details: 'Threat intelligence data is currently unavailable. Please try again later or contact your administrator.',
        provider: 'System'
      };
      setIntel(errorIntel);
      if (onIntelUpdate) onIntelUpdate(errorIntel);
    } finally {
      setIsFetchingIntel(false);
    }
  };

  const fetchTimeline = async () => {
    if (!supabase) {
      console.warn('Supabase not initialized, cannot fetch timeline');
      return;
    }
    setLoadingTimeline(true);
    const alertTime = new Date(alert.timestamp);
    const startTime = new Date(alertTime.getTime() - 15 * 60000).toISOString();
    const endTime = new Date(alertTime.getTime() + 15 * 60000).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('client_id', alert.client_id)
      .gte('timestamp', startTime)
      .lte('timestamp', endTime)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching timeline:', error);
    } else {
      setTimelineEvents(data || []);
    }
    setLoadingTimeline(false);
  };

  return (
    <div 
      className={cn(
        "border-b border-neutral-800 transition-all duration-300 relative",
        isExpanded ? "bg-white/[0.02]" : "hover:bg-white/[0.01]",
        isSelected && "bg-blue-500/5 border-l-2 border-l-blue-500",
        showStatusMenu && "z-50"
      )}
    >
      <div className="px-6 py-4 flex items-center gap-4">
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="text-neutral-600 hover:text-blue-500 transition-colors"
        >
          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
        </button>
        
        <div className="flex items-center gap-3 w-32 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <span className="text-[11px] font-medium text-white">{alert.id}</span>
        </div>
        <div className="w-40 text-[11px] text-neutral-500 font-mono cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>{alert.timestamp}</div>
        
        <div className="flex-1 flex flex-col cursor-pointer truncate" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white truncate">{alert.description}</span>
            {alert.has_report && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-bold text-purple-400 uppercase tracking-tighter">
                <FileText className="w-2.5 h-2.5" />
                Report Generated
              </div>
            )}
          </div>
        </div>
        <div className="w-24 flex justify-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex flex-col items-center">
            <SeverityBadge severity={alert.severity} />
            {alert.rule_level && <span className="text-[9px] text-neutral-600 font-bold mt-1">LVL {alert.rule_level}</span>}
          </div>
        </div>
        <div className="w-32 flex justify-center relative z-30">
          <button 
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="hover:bg-white/5 px-2 py-1 rounded transition-colors"
          >
            <StatusPill status={alert.status === 'Closed' ? (alert.resolution_type || 'Closed') : alert.status} />
          </button>
          
          <AnimatePresence>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: isFirst ? -10 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: isFirst ? -10 : 10 }}
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50 py-1 min-w-[120px]",
                    isFirst ? "top-full mt-2" : "bottom-full mb-2"
                  )}
                >
                  {['Active', 'Investigating', 'Merged', 'Closed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onStatusChange(s);
                        setShowStatusMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-[11px] font-medium hover:bg-white/5 transition-colors",
                        alert.status === s ? "text-blue-400" : "text-neutral-400"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <div className="w-8 flex justify-end cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-8 pt-2">
              {/* Action Buttons at Top */}
              {alert.status !== 'Closed' && alert.status !== 'Escalated' && (
                <div className="mb-6 pb-6 border-b border-neutral-800 flex justify-end gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onEscalate) onEscalate(alert);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-black border border-neutral-800 hover:border-white hover:bg-white/5 text-white text-[11px] font-bold rounded-lg transition-all active:scale-95 uppercase tracking-[0.2em]"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    ESCALATE
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange('Closed');
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold rounded-lg transition-all shadow-lg shadow-red-600/20 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    CLOSE ALERT
                  </button>
                </div>
              )}

              {alert.status === 'Escalated' && (
                <div className="mb-6 pb-6 border-b border-neutral-800 flex justify-end gap-3">
                  <div className="flex-1 flex items-center gap-2 text-purple-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">This alert has been escalated</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('navigate', { 
                        detail: { 
                          page: 'escalations', 
                          data: { alertId: alert.id } 
                        } 
                      }));
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-black border border-neutral-800 hover:border-white hover:bg-white/5 text-white text-[11px] font-bold rounded-lg transition-all active:scale-95 uppercase tracking-[0.2em]"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    VIEW ESCALATION
                  </button>
                </div>
              )}

              {/* Resolution Details - Full Width at Top if Closed */}
              {alert.status === 'Closed' && (alert.resolution_notes || alert.resolution_type) && (
                <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-xl mb-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-5 border-b border-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <ShieldCheck className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-500 block">Resolution Details</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Closed By:</span>
                          <span className="text-[11px] text-red-500 font-bold">{alert.closed_by || 'Analyst 01'}</span>
                        </div>
                      </div>
                    </div>
                    {alert.closed_at && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-neutral-800">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {new Date(alert.closed_at).toLocaleString('en-GB', { 
                            day: '2-digit', month: 'short', year: 'numeric', 
                            hour: '2-digit', minute: '2-digit', second: '2-digit' 
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Resolution Type</span>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {alert.resolution_type}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Analyst Comment</span>
                      <div className="relative pl-4 border-l-2 border-red-500/30 py-1">
                        <p className="text-[13px] text-neutral-200 italic leading-relaxed">
                          "{alert.resolution_notes || 'No comments provided.'}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Details & Threat Intel */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Source IP</span>
                    </div>
                    <p className="text-[13px] font-mono text-white">{alert.source_ip}</p>
                    {alert.agent_name && (
                      <p className="mt-1 text-[10px] text-neutral-500 font-medium">Agent: {alert.agent_name}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded",
                        (intel?.malicious || intel?.reputation === 'Malicious') ? "bg-red-500/10 text-red-500" : 
                        (intel?.reputation === 'Suspicious') ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-orange-500/10 text-orange-500"
                      )}>
                        {(intel?.reputation === 'Malicious' || intel?.reputation === 'Suspicious') ? intel.reputation : 'detect'}
                      </span>
                      <span className="text-[9px] text-neutral-600 font-medium">
                        {(intel?.provider || 'N/A').replace(/\s*(\(Cached\)|API)/g, '')}
                      </span>
                    </div>
                    {alert.case_id && (
                      <div className="mt-3 pt-3 border-t border-neutral-800/50">
                        <div className="flex items-center gap-2 mb-1">
                          <Briefcase className="w-3 h-3 text-blue-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Merged to Case</span>
                        </div>
                        <p className="text-[11px] font-mono text-blue-400">{alert.cases?.title || alert.case_id}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Wazuh Rule</span>
                    </div>
                    <p className="text-[13px] font-mono text-white">{alert.rule_id}</p>
                    <p className="mt-2 text-[9px] text-neutral-600 font-medium">Destination: {alert.dest_ip}</p>
                  </div>
                </div>

                <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-center min-h-[180px]">
                  <div className="w-full flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Threat Intelligence Analysis</span>
                    </div>
                    {showIntel && intel && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">Provider: {(intel.provider || 'N/A').replace(/\s*(\(Cached\)|API)/g, '')}</span>
                        <ExternalLink className="w-3 h-3 text-neutral-600 cursor-pointer hover:text-white transition-colors" />
                      </div>
                    )}
                  </div>
                  
                      {!showIntel ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative overflow-hidden flex flex-col items-center justify-center w-full group"
                        >
                          <div className="relative mb-4">
                            <div className="absolute inset-0 bg-orange-500/10 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-14 h-14 bg-neutral-900/80 rounded-full border border-neutral-800 flex items-center justify-center shadow-inner">
                              <ShieldAlert className="w-7 h-7 text-neutral-600 group-hover:text-orange-500 transition-colors duration-700" />
                            </div>
                          </div>

                          <div className="text-center px-4 relative z-10">
                            <h4 className="text-[11px] font-bold text-white uppercase tracking-[0.2em] mb-2">Indicator Analysis Required</h4>
                            <p className="text-[10px] text-neutral-500 max-w-[280px] mx-auto leading-relaxed mb-6">
                              This source IP has not been analyzed yet. Run a deep-scan to check reputation across global threat intelligence databases.
                            </p>
                            
                            <button 
                              onClick={() => {
                                setShowIntel(true);
                                fetchThreatIntel(false);
                              }}
                              className="group/btn relative flex items-center gap-3 px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-black rounded-xl transition-all shadow-[0_0_20px_rgba(234,88,12,0.2)] hover:shadow-[0_0_30px_rgba(234,88,12,0.4)] active:scale-95 overflow-hidden"
                            >
                              <Zap className="w-4 h-4 fill-current" />
                              <span className="tracking-[0.15em]">RUN THREAT SCAN</span>
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                            </button>
                          </div>
                        </motion.div>
                      ) : isFetchingIntel ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center w-full py-8"
                        >
                          <div className="relative">
                            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                            <div className="absolute inset-0 blur-xl bg-orange-500/20 animate-pulse" />
                          </div>
                          <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.3em] animate-pulse">Analyzing Indicator...</p>
                          <p className="text-[9px] text-neutral-600 mt-2">Querying global threat databases</p>
                        </motion.div>
                      ) : (!intel || intel.reputation === 'Unknown' || intel.reputation === 'Error') ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center w-full py-4"
                        >
                          <div className="w-12 h-12 bg-neutral-900/50 rounded-full flex items-center justify-center mb-4 border border-neutral-800">
                            <ShieldAlert className="w-6 h-6 text-neutral-700" />
                          </div>
                          <p className="text-[10px] text-neutral-500 mb-6 text-center px-10 leading-relaxed max-w-[300px]">
                            {intel?.reputation === 'Error' 
                              ? 'Threat intelligence data is currently unavailable. The external API might be rate-limited or offline.' 
                              : 'This IP is not currently flagged in our primary threat databases. No specific malicious reputation found.'}
                          </p>
                          <button 
                            onClick={() => fetchThreatIntel(false, true)}
                            disabled={isFetchingIntel}
                            className="flex items-center gap-2 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 text-white text-[10px] font-bold rounded-lg transition-all border border-neutral-700/50 hover:border-neutral-600 active:scale-95"
                          >
                            <Zap className="w-3 h-3" />
                            RETRY DEEP SCAN
                          </button>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center w-full">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="px-5 py-2 bg-black/40 rounded-xl border border-neutral-800/50 flex flex-col items-center min-w-[100px]">
                              <p className="text-[8px] text-neutral-500 font-bold uppercase mb-1">Reputation</p>
                              <p className={cn(
                                "text-[13px] font-bold",
                                (intel.malicious || intel.reputation === 'Malicious') ? "text-red-500" :
                                (intel.reputation === 'Suspicious') ? "text-yellow-500" :
                                "text-orange-500"
                              )}>
                                {(intel.reputation === 'Malicious' || intel.reputation === 'Suspicious') ? intel.reputation : 'detect'}
                              </p>
                            </div>
                            <div className="px-5 py-2 bg-black/40 rounded-xl border border-neutral-800/50 flex flex-col items-center min-w-[100px]">
                              <p className="text-[8px] text-neutral-500 font-bold uppercase mb-1">Malicious</p>
                              <p className="text-[13px] font-bold text-white">{intel.malicious ? 'YES' : 'NO'}</p>
                            </div>
                          </div>
                          <p className="text-[12px] text-neutral-400 leading-relaxed max-w-md mb-6">
                            {intel.details}
                          </p>
                          <button 
                            onClick={() => fetchThreatIntel(false, true)}
                            disabled={isFetchingIntel}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] font-bold rounded-lg border border-neutral-800 transition-all flex items-center gap-2"
                          >
                            {isFetchingIntel ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5" />}
                            REFRESH SCAN
                          </button>
                        </div>
                      )}
                </div>

                <div className="p-4 bg-black border border-neutral-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Attack Timeline (±15m)</span>
                    </div>
                    <span className="text-[9px] text-neutral-600 font-bold uppercase">Mapped by AI</span>
                  </div>
                  <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-800">
                    {loadingTimeline ? (
                      <div className="pl-6 py-4 text-[10px] text-neutral-600 animate-pulse">Mapping timeline events...</div>
                    ) : timelineEvents.length === 0 ? (
                      <div className="space-y-4">
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-700" />
                          <p className="text-[10px] text-neutral-500 font-bold">T-15m</p>
                          <p className="text-[11px] text-neutral-600 italic">No correlated events found in this window.</p>
                        </div>
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-red-500/20 border border-red-500" />
                          <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-red-500 animate-ping opacity-20" />
                          <p className="text-[10px] text-red-500 font-bold">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                          <p className="text-[11px] text-white font-medium">Alert Triggered: {alert.description}</p>
                          <p className="text-[9px] text-neutral-500 mt-0.5">Rule ID: {alert.rule_id} | Level: {alert.rule_level || 'N/A'}</p>
                        </div>
                        <div className="relative pl-6">
                          <div className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full bg-neutral-900 border border-neutral-700" />
                          <p className="text-[10px] text-neutral-500 font-bold">T+15m</p>
                          <p className="text-[11px] text-neutral-600 italic">Monitoring for subsequent activity...</p>
                        </div>
                      </div>
                    ) : (
                      timelineEvents.map((event, idx) => {
                        const isAlert = event.timestamp === alert.timestamp;
                        return (
                          <div key={event.id || idx} className="relative pl-6">
                            <div className={cn(
                              "absolute left-0 top-1 w-3.5 h-3.5 rounded-full",
                              isAlert ? "bg-red-500/20 border border-red-500" : "bg-neutral-900 border border-neutral-700"
                            )} />
                            <p className={cn(
                              "text-[10px] font-bold",
                              isAlert ? "text-red-500" : "text-neutral-500"
                            )}>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </p>
                            <p className={cn(
                              "text-[11px]",
                              isAlert ? "text-white font-medium" : "text-neutral-300"
                            )}>
                              {event.description}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <LogViewer 
                  data={alert.raw_log} 
                  viewMode={logViewMode} 
                  onViewModeChange={setLogViewMode} 
                />
              </div>

              {/* AI Assistant - HIDDEN FOR NOW AS REQUESTED */}
              {/* <AIAssistant alert={alert} /> */}
              
              <div className="flex flex-col h-[400px] bg-neutral-900/30 border border-neutral-800 border-dashed rounded-lg items-center justify-center p-8 text-center">
                <Bot className="w-12 h-12 text-neutral-700 mb-4" />
                <h4 className="text-white font-bold text-sm mb-2">AI Analysis on Standby</h4>
                <p className="text-neutral-500 text-[12px] max-w-xs">
                  The AI Assistant is currently disabled while we focus on Wazuh ingestion and timeline mapping.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};

const MOCK_ALERTS: SecurityAlert[] = [];
const MOCK_EVENTS: any[] = [];

// --- Alert Details Modal ---

const AlertDetailsModal = ({ 
  alert, 
  isOpen, 
  onClose,
  onStatusChange,
  onIntelUpdate,
  onEscalate,
  onGenerateReport
}: { 
  alert: SecurityAlert | null; 
  isOpen: boolean; 
  onClose: () => void;
  onStatusChange: (newStatus: string) => void;
  onIntelUpdate?: (alertId: string, intel: SecurityAlert['threat_intel']) => void;
  onEscalate?: () => void;
  onGenerateReport?: () => void;
}) => {
  const [isFetchingIntel, setIsFetchingIntel] = useState(false);
  const [logViewMode, setLogViewMode] = useState<'raw' | 'table'>('raw');
  const [localIntel, setLocalIntel] = useState<SecurityAlert['threat_intel'] | null>(alert?.threat_intel || null);

  useEffect(() => {
    if (alert) {
      setLocalIntel(alert.threat_intel || null);
    }
  }, [alert]);

  if (!alert || !isOpen) return null;

  const fetchThreatIntel = async () => {
    if (!alert.source_ip || alert.source_ip === 'N/A' || alert.source_ip === '0.0.0.0') return;
    setIsFetchingIntel(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const apiResponse = await fetch(`/api/threat-intel/ip/${encodeURIComponent(alert.source_ip)}`, {
        headers: {
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        }
      });
      
      let apiResult: any = null;
      if (apiResponse.ok) {
        apiResult = await apiResponse.json();
      }

      if (apiResponse.ok && apiResult && apiResult.reputation !== 'Error' && apiResult.reputation !== 'Unknown') {
        const newIntel = {
          reputation: apiResult.reputation,
          malicious: apiResult.malicious,
          details: apiResult.details,
          provider: apiResult.provider
        };
        setLocalIntel(newIntel);
        if (onIntelUpdate) onIntelUpdate(alert.id, newIntel);
        return;
      }

      const systemInstruction = "Perform a real-time threat intelligence lookup for security indicators.";
      const prompt = `Indicator Analysis:
      Source IP: ${alert.source_ip}
      Alert Context: ${alert.description}
      Search for this IP on threat intelligence platforms. Determine if the IP is known for malicious activity. Returns JSON.`;

      const result = await generateAINarrative(prompt, systemInstruction);
      const aiIntel = {
        reputation: result.reputation || 'Unknown',
        malicious: !!result.malicious,
        details: result.details || 'No specific details found.',
        provider: result.provider || 'Gemini AI'
      };
      setLocalIntel(aiIntel);
      if (onIntelUpdate) onIntelUpdate(alert.id, aiIntel);
    } catch (error) {
      console.error("Error fetching threat intel in modal:", error);
    } finally {
      setIsFetchingIntel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-white">Alert Details</h3>
                <SeverityBadge severity={alert.severity} />
                <StatusPill status={alert.status === 'Closed' ? (alert.resolution_type || 'Closed') : alert.status} />
              </div>
              <p className="text-xs text-neutral-500 font-mono">ID: {alert.id} • {new Date(alert.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="space-y-8">
            {/* Action Buttons at Top */}
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
              <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Quick Actions</h4>
              <div className="flex flex-wrap gap-3">
                {alert.status !== 'Escalated' && (
                  <button 
                    onClick={() => onStatusChange('Escalated')}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-600/20"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    ESCALATE TO REPORT
                  </button>
                )}
                {alert.status === 'Escalated' && (
                  <div className="flex-1 flex items-center gap-2 text-purple-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">This alert has been escalated for reporting</span>
                  </div>
                )}
                <button 
                  onClick={() => onStatusChange('Investigating')}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Search className="w-4 h-4" />
                  INVESTIGATE
                </button>
                <button 
                  onClick={() => onStatusChange('Closed')}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  CLOSE ALERT
                </button>
                {alert.status === 'Escalated' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('navigate', { 
                        detail: { 
                          page: 'reports', 
                          data: { type: 'Escalation', alert: alert } 
                        } 
                      }));
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-purple-500/20 active:scale-95"
                  >
                    <FileText className="w-4 h-4" />
                    VIEW IN REPORTS
                  </button>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div>
              <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-3">Description</h4>
              <p className="text-lg text-white font-medium leading-relaxed">{alert.description}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Technical Details */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Source IP</span>
                    </div>
                    <p className="text-[15px] font-mono text-white">{alert.source_ip}</p>
                    {alert.agent_name && (
                      <p className="mt-1 text-[11px] text-neutral-500">Agent: {alert.agent_name}</p>
                    )}
                  </div>
                  <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Rule ID</span>
                    </div>
                    <p className="text-[15px] font-mono text-white">{alert.rule_id}</p>
                    {alert.rule_level && (
                      <p className="mt-1 text-[11px] text-neutral-500">Level: {alert.rule_level}</p>
                    )}
                  </div>
                </div>

                <LogViewer 
                  data={alert.raw_log} 
                  viewMode={logViewMode} 
                  onViewModeChange={setLogViewMode} 
                />
              </div>

              {/* Right Column: Analysis & Actions */}
              <div className="space-y-6">
                {/* Threat Intelligence Section */}
                <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-center min-h-[180px]">
                  <div className="w-full flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Threat Intelligence</span>
                    </div>
                    {localIntel && (
                      <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter">Provider: {localIntel.provider}</span>
                    )}
                  </div>

                  {localIntel ? (
                    <div className="flex flex-col items-center w-full">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="px-5 py-2.5 bg-black/40 rounded-xl border border-neutral-800/50 flex flex-col items-center min-w-[100px]">
                          <p className="text-[8px] text-neutral-500 font-bold uppercase mb-1">Reputation</p>
                          <p className={cn(
                            "text-[14px] font-bold",
                            localIntel.malicious ? "text-red-500" : "text-orange-500"
                          )}>
                            {localIntel.reputation}
                          </p>
                        </div>
                        <div className="px-5 py-2.5 bg-black/40 rounded-xl border border-neutral-800/50 flex flex-col items-center min-w-[100px]">
                          <p className="text-[8px] text-neutral-500 font-bold uppercase mb-1">Malicious</p>
                          <p className="text-[14px] font-bold text-white">{localIntel.malicious ? 'YES' : 'NO'}</p>
                        </div>
                      </div>
                      <p className="text-[13px] text-neutral-400 leading-relaxed max-w-md mb-6">
                        {localIntel.details}
                      </p>
                      <button 
                        onClick={fetchThreatIntel}
                        disabled={isFetchingIntel}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] font-bold rounded-lg border border-neutral-800 transition-all flex items-center gap-2"
                      >
                        {isFetchingIntel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        REFRESH SCAN
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 w-full">
                      {isFetchingIntel ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                          <p className="text-[11px] text-orange-500 font-bold uppercase tracking-[0.2em]">Analyzing Indicator...</p>
                        </div>
                      ) : (
                        <>
                          <div className="w-14 h-14 rounded-full bg-orange-500/5 flex items-center justify-center mb-4 border border-orange-500/10">
                            <ShieldAlert className="w-7 h-7 text-neutral-700" />
                          </div>
                          <p className="text-[12px] text-neutral-500 mb-6 max-w-[240px]">No threat intelligence data available for this indicator.</p>
                          <button 
                            onClick={fetchThreatIntel}
                            className="px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center gap-2"
                          >
                            <Zap className="w-4 h-4" />
                            DETECT THREAT INTEL
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-1 bg-blue-500/20 text-[8px] font-black text-blue-400 uppercase tracking-widest rounded-bl">
                    Under Construction
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <Bot className="w-5 h-5 text-blue-500" />
                    <h4 className="text-sm font-bold text-white">AI Investigation Summary</h4>
                  </div>
                  <p className="text-[13px] text-neutral-400 leading-relaxed mb-6 italic">
                    "We are currently building our advanced AI analysis engine. Soon, this section will provide automated root-cause analysis, impact assessment, and generated remediation playbooks for every alert."
                  </p>
                  <div className="flex flex-wrap gap-2 opacity-50 grayscale">
                    <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase">Coming Soon</span>
                    <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase">Auto-Triage</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/60 border-t border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[11px] text-neutral-400 font-medium">Client: {alert.client_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neutral-700" />
              <span className="text-[11px] text-neutral-400 font-medium">Status: {alert.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-transparent hover:bg-white/5 text-neutral-500 hover:text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
            >
              CANCEL
            </button>
            <button 
              onClick={onEscalate}
              className="px-6 py-2.5 bg-black border border-neutral-800 hover:border-white hover:bg-white/5 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 uppercase tracking-[0.2em]"
            >
              {alert.status === 'Escalated' ? 'VIEW ESCALATION' : 'ESCALATE'}
            </button>
            <button 
              onClick={onGenerateReport}
              className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
            >
              GENERATE REPORT
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default function AlertsPage({ user }: { user?: any }) {
  const { currentClient } = useClient();
  const { settings, addNotification } = useNotifications();
  // Main component for managing security alerts
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set(['ALL']));
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['ALL']));
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [ipFilter, setIpFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [caseIdFilter, setCaseIdFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('ALL');
  const [intelFilter, setIntelFilter] = useState('ALL');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [clientName, setClientName] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [availableCases, setAvailableCases] = useState<{id: string, title: string}[]>([]);
  
  // Selection & Pagination
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [closingAlert, setClosingAlert] = useState<SecurityAlert | null>(null);
  const [escalatingAlert, setEscalatingAlert] = useState<SecurityAlert | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isBulkClosing, setIsBulkClosing] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [ipIntelCache, setIpIntelCache] = useState<Record<string, SecurityAlert['threat_intel']>>({});
  const [escalationSuccessReport, setEscalationSuccessReport] = useState<any>(null);
  
  // Alert Intelligence State
  const [viewMode, setViewMode] = useState<'all' | 'correlated' | 'playbooks'>(() => {
    return (localStorage.getItem('kastron_alerts_view') as any) || 'all';
  });
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [alertPlaybooks, setAlertPlaybooks] = useState<AlertPlaybook[]>([]);
  const [isCloseGroupModalOpen, setIsCloseGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AlertGroup | null>(null);
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<SecurityAlert | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const isAlertExpanded = !!(
      selectedAlertForModal || 
      closingAlert || 
      escalatingAlert || 
      isMergeModalOpen || 
      isCloseGroupModalOpen || 
      isBulkClosing
    );
    window.dispatchEvent(new CustomEvent('alertsPageStateChange', { 
      detail: { isScrolled, isAlertExpanded } 
    }));
  }, [isScrolled, selectedAlertForModal, closingAlert, escalatingAlert, isMergeModalOpen, isCloseGroupModalOpen, isBulkClosing]);

  useEffect(() => {
    localStorage.setItem('kastron_alerts_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (alerts.length > 0) {
      const newCache = { ...ipIntelCache };
      let changed = false;
      alerts.forEach(a => {
        if (a.threat_intel && a.threat_intel.reputation !== 'Unknown' && a.threat_intel.reputation !== 'Error') {
          const current = newCache[a.source_ip];
          // Update cache if:
          // 1. No entry yet
          // 2. Current entry is non-definitive (Unknown/Error)
          // 3. New intel is different and definitive (this handles real-time updates from other alerts)
          if (!current || 
              current.reputation === 'Unknown' || 
              current.reputation === 'Error' || 
              (a.threat_intel.reputation !== current.reputation)) {
            newCache[a.source_ip] = a.threat_intel;
            changed = true;
          }
        }
      });
      if (changed) setIpIntelCache(newCache);
    }
  }, [alerts]);

  useEffect(() => {
    if (currentClient) {
      setClientName(currentClient.name);
    }
  }, [currentClient]);

  useEffect(() => {
    if (!supabase || !currentClient) return;

  const checkTables = async () => {
      try {
        const { error: casesError } = await supabase.from('cases').select('id').limit(1);
        if (casesError && (casesError.code === 'PGRST116' || casesError.message.includes('relation "cases" does not exist'))) {
          setDebugInfo(prev => prev + ' Warning: The "cases" table does not exist.');
        }
        
        const { error: intelError } = await supabase.from('threat_intel_cache').select('*').limit(1);
        if (intelError && (intelError.code === 'PGRST116' || intelError.message.includes('relation "threat_intel_cache" does not exist'))) {
          // Silent fallback for intel, but log for dev
          console.warn('Threat intel cache table missing');
        }
      } catch (e) {
        console.error('Error checking tables:', e);
      }
    };

    checkTables();
    fetchFilterOptions();
    fetchAlertIntelligence();

    // Check for nav_data to open a specific alert
    const navDataStr = window.sessionStorage.getItem('nav_data');
    if (navDataStr) {
      try {
        const navData = JSON.parse(navDataStr);
        if (navData.openAlertId) {
          // Fetch the specific alert
          supabase.from('alerts').select('*').eq('id', navData.openAlertId).single().then(({ data, error }) => {
            if (data && !error) {
              setSelectedAlertForModal(data as SecurityAlert);
            }
          });
          window.sessionStorage.removeItem('nav_data');
        }
      } catch (e) {
        console.error('Failed to parse nav_data:', e);
      }
    }

    // Subscribe to real-time updates
    const channel = supabase
      .channel('realtime_alerts')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts',
        filter: `client_id=eq.${currentClient.id}`
      }, (payload) => {
        console.log('Alert change received:', payload);
        
        if (payload.eventType === 'INSERT') {
          const rawAlert = payload.new as any;
          // Ensure severity is mapped correctly
          let severity = rawAlert.severity || (rawAlert.rule_level ? getSeverityFromLevel(rawAlert.rule_level) : 'LOW');
          severity = severity.toUpperCase();
          
          const newAlert: SecurityAlert = { 
            ...rawAlert, 
            severity,
            status: rawAlert.status || 'Active'
          };
          
          // Check if it matches current filters to decide if it should be added to the list
          const matchesClient = newAlert.client_id === currentClient.id;
          const currentSeverityFilters = Array.from(severityFilter);
          const matchesSeverity = currentSeverityFilters.includes('ALL') || 
            currentSeverityFilters.some(s => s.toUpperCase() === newAlert.severity.toUpperCase());
          
          const currentStatusFilters = Array.from(statusFilter);
          const matchesStatus = currentStatusFilters.includes('ALL') || 
            currentStatusFilters.some(s => s.toLowerCase() === (newAlert.status || '').toLowerCase());
            
          const matchesSearch = !searchQuery || newAlert.description.toLowerCase().includes(searchQuery.toLowerCase());

          if (matchesClient && matchesSeverity && matchesStatus && matchesSearch) {
            setAlerts(prev => {
              // Prevent duplicates
              if (prev.some(a => a.id === newAlert.id)) return prev;
              return [newAlert, ...prev];
            });
            // Update filter options if new agent appears
            if (newAlert.agent_name && !availableAgents.includes(newAlert.agent_name)) {
              setAvailableAgents(prev => [...new Set([...prev, newAlert.agent_name!])].sort());
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedAlert = payload.new as any;
          setAlerts(prev => prev.map(a => {
            if (a.id === updatedAlert.id) {
              // Merge updates but keep existing fields if not provided in payload
              return { ...a, ...updatedAlert };
            }
            return a;
          }));
        } else if (payload.eventType === 'DELETE') {
          setAlerts(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time alerts');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('Real-time connection lost, alerts may not update automatically');
        }
      });

    // Subscribe to alert_groups changes
    const groupsChannel = supabase
      .channel('alert_groups_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'alert_groups',
        filter: `client_id=eq.${currentClient.id}`
      }, (payload) => {
        console.log('Alert group change received:', payload);
        if (payload.eventType === 'UPDATE') {
          setAlertGroups(prev => prev.map(g => 
            g.id === payload.new.id ? (payload.new as AlertGroup) : g
          ));
        } else if (payload.eventType === 'INSERT') {
          setAlertGroups(prev => [payload.new as AlertGroup, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setAlertGroups(prev => prev.filter(g => g.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(groupsChannel);
    };
  }, [currentClient?.id]);

  useEffect(() => {
    if (!supabase || !currentClient) return;
    fetchAlerts();
  }, [user, currentClient, severityFilter, statusFilter, searchQuery, dateRange, ipFilter, ruleFilter, caseFilter, caseIdFilter, intelFilter, agentFilter, classificationFilter, currentPage, pageSize]);

  const handleViewAllAlerts = (ruleDescription: string) => {
    setViewMode('all');
    setSearchQuery(ruleDescription);
    // Scroll to top to see the filtered list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseGroup = async (resolutionType: string, resolutionNotes: string, createPlaybook: boolean) => {
    if (!selectedGroup || !supabase || !currentClient) return;

    try {
      setLoading(true);
      const closedAt = new Date().toISOString();
      const closedBy = user?.email || 'Analyst 01';

      // 1. Update alert_groups
      console.log('Updating alert_group:', selectedGroup.id, 'to status: Closed');
      const { error: groupError, count: groupCount } = await supabase
        .from('alert_groups')
        .update({
          status: 'Closed',
          resolution_type: resolutionType,
          resolution_notes: resolutionNotes,
          closed_by: closedBy,
          closed_at: closedAt
        }, { count: 'exact' })
        .eq('id', selectedGroup.id);

      if (groupError) {
        console.error('Error updating alert_groups:', groupError);
        throw new Error(`Failed to update alert group: ${groupError.message}`);
      }
      
      if (groupCount === 0) {
        console.warn('No alert group was updated. Check RLS policies for alert_groups table.');
        setDebugInfo('Warning: Alert group status was not updated in the database. Please check your Supabase RLS policies for UPDATE access on the "alert_groups" table.');
      }

      // 2. Update all alerts in this group
      console.log('Updating alerts for rule_id:', selectedGroup.rule_id, 'to status: Closed');
      const { error: alertsError, count: alertsCount } = await supabase
        .from('alerts')
        .update({
          status: 'Closed',
          resolution_type: resolutionType,
          resolution_notes: resolutionNotes,
          closed_by: closedBy,
          closed_at: closedAt
        }, { count: 'exact' })
        .eq('client_id', currentClient.id)
        .eq('rule_id', selectedGroup.rule_id);

      if (alertsError) {
        console.error('Error updating alerts in group:', alertsError);
        throw new Error(`Failed to update alerts in group: ${alertsError.message}`);
      }

      console.log(`Successfully updated ${alertsCount} alerts in group.`);

      // 3. Create playbook if requested
      if (createPlaybook) {
        const { error: playbookError } = await supabase
          .from('alert_playbooks')
          .upsert({
            client_id: currentClient.id,
            rule_id: selectedGroup.rule_id,
            rule_description: selectedGroup.rule_description,
            auto_action: 'Auto-Close',
            resolution_type: resolutionType,
            resolution_notes: resolutionNotes,
            created_by: closedBy,
            active: true
          }, { onConflict: 'client_id,rule_id' });

        if (playbookError) throw playbookError;
      }

      setIsCloseGroupModalOpen(false);
      setSelectedGroup(null);
      
      // Optimistic update for groups
      setAlertGroups(prev => prev.map(g => 
        g.id === selectedGroup.id ? { ...g, status: 'Closed' } : g
      ));

      // Optimistic update for alerts
      setAlerts(prev => prev.map(a => 
        a.rule_id === selectedGroup.rule_id ? { ...a, status: 'Closed' } : a
      ));

      fetchAlertIntelligence();
      fetchAlerts();
    } catch (error) {
      console.error('Error closing group:', error);
      setDebugInfo(`Failed to close group: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlaybook = async (playbook: AlertPlaybook) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('alert_playbooks')
        .update({ active: !playbook.active })
        .eq('id', playbook.id);
      
      if (error) throw error;
      setAlertPlaybooks(prev => prev.map(p => p.id === playbook.id ? { ...p, active: !p.active } : p));
    } catch (error) {
      console.error('Error toggling playbook:', error);
    }
  };

  const handleDeletePlaybook = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('alert_playbooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setAlertPlaybooks(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting playbook:', error);
    }
  };

  const fetchFilterOptions = async () => {
    if (!supabase || !currentClient) return;

    try {
      // Fetch unique agents from recent alerts for performance
      const { data: agentData } = await supabase
        .from('alerts')
        .select('agent_name')
        .eq('client_id', currentClient.id)
        .not('agent_name', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (agentData) {
        const uniqueAgents = Array.from(new Set(agentData.map(a => a.agent_name))).filter(Boolean).sort() as string[];
        setAvailableAgents(uniqueAgents);
      }

      // Fetch active cases
      const { data: caseData } = await supabase
        .from('cases')
        .select('id, title')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });
      
      if (caseData) {
        setAvailableCases(caseData);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchAlertIntelligence = async () => {
    if (!supabase || !currentClient) return;

    try {
      // Fetch alert groups (limited to 200 most recent for performance)
      const { data: groups, error: groupsError } = await supabase
        .from('alert_groups')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('last_seen', { ascending: false })
        .limit(200);

      if (groupsError) throw groupsError;
      setAlertGroups(groups || []);

      // Fetch alert playbooks
      const { data: playbooks, error: playbooksError } = await supabase
        .from('alert_playbooks')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });

      if (playbooksError) throw playbooksError;
      setAlertPlaybooks(playbooks || []);
    } catch (error) {
      console.error('Error fetching alert intelligence:', error);
    }
  };

  const handleGenerateReport = async (alert: SecurityAlert) => {
    if (!supabase || !currentClient) return;
    setIsGeneratingReport(true);
    try {
      const reportContent = await generateStructuredSOCReport({
        type: 'Escalation',
        alertData: alert,
        analystName: user?.email || 'System AI'
      });

      const { data: newReport, error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: currentClient.id,
          title: `Incident Report: ${alert.description}`,
          type: 'incident_report',
          status: 'draft',
          content: reportContent,
          alert_id: alert.id,
          agent_name: alert.agent_name,
          generated_by: user?.email,
          date_from: alert.timestamp,
          date_to: alert.timestamp
        })
        .select()
        .single();

      if (reportError) throw reportError;
      
      addNotification({
        type: 'report_generated',
        title: 'AI Report Generated',
        description: `Successfully generated incident report for alert ${alert.id}.`,
        alertId: alert.id
      });

      // Update alert status to Escalated if not already
      await supabase.from('alerts').update({ status: 'Escalated' }).eq('id', alert.id);

      setEscalationSuccessReport(newReport);
      setSelectedAlertForModal(null);
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleEscalateDirect = (alert: SecurityAlert) => {
    setEscalatingAlert(alert);
    setSelectedAlertForModal(null);
  };

  const fetchAlerts = async (retryCount = 0) => {
    if (!supabase || !currentClient) {
      if (!currentClient && loading) setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      if (currentPage === 1) {
        // High-priority sync for orphaned or misaligned alerts
        const syncAlerts = async () => {
          try {
            // 1. Check if we have visible clients
            const { count: visibleClients } = await supabase.from('clients').select('*', { count: 'exact', head: true });
            
            // 2. Identify if we need to claim anything
            // We claim if:
            // - We match by Wazuh Group (most accurate)
            // - OR We are the ONLY client and there are alerts with different IDs
            
            if (currentClient.wazuh_group) {
              await supabase
                .from('alerts')
                .update({ client_id: currentClient.id })
                .eq('wazuh_group', currentClient.wazuh_group)
                .neq('client_id', currentClient.id);
            }
            
            if (visibleClients === 1) {
              const { data: mismatchCount } = await supabase
                .from('alerts')
                .select('id')
                .neq('client_id', currentClient.id)
                .limit(1);
              
              if (mismatchCount && mismatchCount.length > 0) {
                console.log('Detected ghost alerts, claiming for only visible client...');
                await supabase
                  .from('alerts')
                  .update({ client_id: currentClient.id })
                  .neq('client_id', currentClient.id);
                  
                // Also claim alert groups just in case
                await supabase
                  .from('alert_groups')
                  .update({ client_id: currentClient.id })
                  .neq('client_id', currentClient.id);
                  
                fetchAlerts(0); // Refresh after claiming
              }
            }
          } catch (e) {
            console.warn('Alert sync healing failed:', e);
          }
        };
        syncAlerts();
      }

      let query = supabase
        .from('alerts')
        .select('*', { count: 'exact' });

      // ROBUST FILTERING: We prefer client_id, but fallback to wazuh_group 
      // if the environment is in the middle of a data sync or re-claim.
      if (currentClient.wazuh_group) {
        query = query.or(`client_id.eq.${currentClient.id},wazuh_group.eq.${currentClient.wazuh_group}`);
      } else {
        query = query.eq('client_id', currentClient.id);
      }

      query = query.order('timestamp', { ascending: false });

      if (!severityFilter.has('ALL')) {
        const severityValues = Array.from(severityFilter);
        const orConditions: string[] = [];
        
        severityValues.forEach(sev => {
          // Check both the severity column (case-insensitive) and the rule_level as fallback
          orConditions.push(`severity.ilike.${sev}`);
          
          if (sev === 'CRITICAL') {
            orConditions.push('rule_level.gte.12');
          } else if (sev === 'HIGH') {
            orConditions.push('and(rule_level.gte.8,rule_level.lt.12)');
          } else if (sev === 'MEDIUM') {
            orConditions.push('and(rule_level.gte.5,rule_level.lt.8)');
          } else if (sev === 'LOW') {
            orConditions.push('rule_level.lt.5');
          }
        });
        
        query = query.or(orConditions.join(','));
      }

      if (!statusFilter.has('ALL')) {
        const statusValues = Array.from(statusFilter);
        const allCases = [...statusValues, ...statusValues.map(s => s.toLowerCase())];
        query = query.in('status', allCases);
      }

      if (searchQuery) {
        query = query.ilike('description', `%${searchQuery}%`);
      }

      if (dateRange.start) {
        query = query.gte('timestamp', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('timestamp', dateRange.end);
      }

      if (ipFilter) {
        query = query.ilike('source_ip', `%${ipFilter}%`);
      }

      if (ruleFilter) {
        query = query.ilike('rule_id', `%${ruleFilter}%`);
      }

      if (caseFilter) {
        if (caseFilter === 'NONE') {
          query = query.is('case_id', null);
        } else if (caseFilter === 'ANY') {
          query = query.not('case_id', 'is', null);
        }
      }

      if (caseIdFilter) {
        query = query.eq('case_id', caseIdFilter);
      }

      if (agentFilter) {
        query = query.eq('agent_name', agentFilter);
      }

      if (classificationFilter !== 'ALL') {
        query = query.eq('resolution_type', classificationFilter);
      }

      if (intelFilter !== 'ALL') {
        if (intelFilter === 'Unknown') {
          query = query.or('threat_intel->>reputation.eq.Unknown,threat_intel.is.null');
        } else {
          query = query.eq('threat_intel->>reputation', intelFilter);
        }
      }

      // Add pagination limit for performance
      query = query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const { data, error, count } = await query;
      if (count !== null) setTotalAlerts(count);

      // Fetch the threat intel cache to merge with alerts that don't have it yet
      const { data: cacheData, error: cacheFetchError } = await supabase
        .from('threat_intel_cache')
        .select('*');
      
      if (cacheFetchError) {
        console.error('Error fetching cache:', cacheFetchError);
        setDebugInfo(`Cache Fetch Error: ${cacheFetchError.message} (${cacheFetchError.code})`);
      }
      
      const cacheMap = (cacheData || []).reduce((acc, item) => {
        acc[item.ip] = {
          reputation: item.reputation,
          malicious: item.malicious,
          details: item.details,
          provider: item.provider.replace(/\s*(\(Cached\)|API)/g, '')
        };
        return acc;
      }, {} as Record<string, any>);

      if (error) {
        console.error('Error fetching alerts:', error);
        if (retryCount < 2) {
          console.log(`Retrying alerts fetch (Attempt ${retryCount + 2})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchAlerts(retryCount + 1);
        }
        setDebugInfo(`Alerts Fetch Error: ${error.message}`);
        setAlerts([]);
      } else {
        if (data && data.length > 0) {
          const mappedData = data.map(a => {
            let severity = a.severity || (a.rule_level ? getSeverityFromLevel(a.rule_level) : 'LOW');
            severity = severity.toUpperCase();
            
            // Merge from cache if the alert itself doesn't have threat intel stored OR if the stored intel is non-definitive
            let threat_intel = a.threat_intel;
            const cached = cacheMap[a.source_ip];
            
            if (!threat_intel || threat_intel.reputation === 'Unknown' || threat_intel.reputation === 'Error') {
              if (cached && cached.reputation !== 'Unknown' && cached.reputation !== 'Error') {
                threat_intel = cached;
              }
            }
            
            return {
              ...a,
              severity,
              threat_intel
            };
          });
          setAlerts(mappedData);
          setDebugInfo(''); // Clear debug info if data is found
        } else {
          setAlerts([]);
          setDebugInfo('No alerts found matching the current filters.');
        }
      }
    } catch (e) {
      console.error('General error in fetchAlerts:', e);
      if (retryCount < 2) {
        console.log(`Retrying alerts fetch after catch (Attempt ${retryCount + 2})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchAlerts(retryCount + 1);
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('quota')) {
        setDebugInfo('System is currently under heavy load or quota has been reached. Please try again in a few moments.');
      } else {
        setDebugInfo(`System Error: ${msg}`);
      }
    }
    setLoading(false);
  };

  const handleStatusChange = async (alert: SecurityAlert, newStatus: string) => {
    if (newStatus === 'Closed') {
      setClosingAlert(alert);
      return;
    }

    if (newStatus === 'Merged') {
      setSelectedAlertIds(new Set([alert.id]));
      setIsMergeModalOpen(true);
      return;
    }

    if (!supabase || !currentClient) {
      setDebugInfo(`Cannot update status: ${!supabase ? 'Supabase client not initialized' : 'No active client selected'}.`);
      return;
    }

    try {
      const { error, count } = await supabase
        .from('alerts')
        .update({ status: newStatus }, { count: 'exact' })
        .eq('id', alert.id)
        .eq('client_id', currentClient.id);

      if (error) throw error;
      
      if (count === 0) {
        setDebugInfo('Warning: Alert status was not updated in the database. Please check your Supabase RLS policies for UPDATE access.');
      }
      
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: newStatus } : a));
    } catch (error) {
      console.error('Error updating status:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('quota')) {
        setDebugInfo('Action failed due to system load. Please try again shortly.');
      } else {
        setDebugInfo(`Failed to update status: ${msg}`);
      }
    }
  };

  const confirmCloseAlert = async (comment: string, resolution: string) => {
    if (!closingAlert && !isBulkClosing) {
      console.warn('No alert selected for closing');
      return;
    }

    if (!supabase) {
      setDebugInfo('Cannot close alert: Supabase client not initialized.');
      return;
    }

    try {
      const idsToUpdate = isBulkClosing ? Array.from(selectedAlertIds) : [closingAlert!.id];
      const closedAt = new Date().toISOString();
      
      // Try to get current user email, fallback to Analyst 01
      let closedBy = 'Analyst 01';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) closedBy = user.email;
      } catch (e) {
        console.warn('Could not fetch user for closed_by:', e);
      }
      
      const { error, count } = await supabase
        .from('alerts')
        .update({ 
          status: 'Closed',
          resolution_notes: comment || 'No comments provided.',
          resolution_type: resolution,
          closed_at: closedAt,
          closed_by: closedBy
        }, { count: 'exact' })
        .in('id', idsToUpdate)
        .eq('client_id', currentClient.id);

      if (error) throw error;
      
      if (count === 0) {
        console.warn('No rows were updated. This might be due to RLS policies.');
        setDebugInfo('Warning: Alert status was not updated in the database. Please check your Supabase RLS policies for UPDATE access.');
        // We still update local state so the user sees their action, 
        // but they are warned it didn't persist.
      }

      // Update local state
      setAlerts(prev => prev.map(a => idsToUpdate.includes(a.id) ? { 
        ...a, 
        status: 'Closed',
        resolution_notes: comment || 'No comments provided.',
        resolution_type: resolution,
        closed_at: closedAt,
        closed_by: closedBy
      } : a));
      
      // Reset states
      setClosingAlert(null);
      setIsBulkClosing(false);
      if (isBulkClosing) setSelectedAlertIds(new Set());
      
      console.log('Alert(s) closed successfully:', idsToUpdate);
    } catch (error) {
      console.error('Error closing alert:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('quota')) {
        setDebugInfo('Action failed due to system load. Please try again shortly.');
      } else {
        setDebugInfo(`Failed to close alert: ${msg}`);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedAlertIds.size === paginatedAlerts.length) {
      setSelectedAlertIds(new Set());
    } else {
      const newSelection = new Set(selectedAlertIds);
      paginatedAlerts.forEach(a => newSelection.add(a.id));
      setSelectedAlertIds(newSelection);
    }
  };

  const toggleSelectAlert = (id: string) => {
    const newSelection = new Set(selectedAlertIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedAlertIds(newSelection);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedAlertIds.size === 0) return;
    if (!supabase || !currentClient) return;
    
    if (newStatus === 'Closed') {
      setIsBulkClosing(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: newStatus })
        .in('id', Array.from(selectedAlertIds))
        .eq('client_id', currentClient.id);

      if (error) throw error;
      
      setAlerts(prev => prev.map(a => selectedAlertIds.has(a.id) ? { ...a, status: newStatus } : a));
      setSelectedAlertIds(new Set());
    } catch (error) {
      console.error('Error in bulk status update:', error);
    }
  };

  const handleEscalateConfirm = async (priority: string, assignedTo: string, notes: string, action: 'escalate' | 'report') => {
    if (!escalatingAlert || !supabase || !currentClient) return;

    setIsGeneratingReport(true);
    try {
      let reportContent = {};
      let newReport = null;
      
      if (action === 'report') {
        try {
          reportContent = await generateStructuredSOCReport({
            type: 'Escalation',
            alertData: escalatingAlert,
            analystName: user?.email || 'System AI'
          });
        } catch (error) {
          console.error('AI Report Generation failed:', error);
        }

        // Create Report in Supabase
        const { data, error: reportError } = await supabase
          .from('reports')
          .insert({
            client_id: currentClient.id,
            title: `Incident Report: ${escalatingAlert.description}`,
            type: 'incident_report',
            status: 'draft',
            content: reportContent,
            alert_id: escalatingAlert.id,
            agent_name: escalatingAlert.agent_name,
            generated_by: user?.email,
            date_from: escalatingAlert.timestamp,
            date_to: escalatingAlert.timestamp
          })
          .select()
          .single();

        if (reportError) throw reportError;
        newReport = data;

        addNotification({
          type: 'report_generated',
          title: 'AI Report Generated',
          description: `Successfully generated incident report for alert ${escalatingAlert.id}.`,
          alertId: escalatingAlert.id
        });
      }

      // 1. Update Alert Status in Supabase
      const { error: alertError } = await supabase
        .from('alerts')
        .update({ 
          status: 'Escalated',
          resolution_notes: notes ? `Escalated: ${notes}` : 'Escalated to incident report'
        })
        .eq('id', escalatingAlert.id);

      if (alertError) throw alertError;

      // 2. Create Escalation in Supabase
      const sev = escalatingAlert.severity?.toLowerCase() as keyof typeof settings.slaLimits;
      const slaMinutes = settings.slaLimits?.[sev] || settings.slaLimitMinutes || 240;

      const { error: escalationError } = await supabase
        .from('escalations')
        .insert({
          escalation_id: `ESC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          client_id: currentClient.id,
          alert_id: escalatingAlert.id,
          report_id: newReport?.id || null,
          title: escalatingAlert.description,
          priority: priority,
          status: 'New',
          severity: escalatingAlert.severity,
          escalated_by: user?.email || 'System',
          assigned_to: assignedTo || null,
          escalation_notes: notes,
          sla_deadline: new Date(Date.now() + slaMinutes * 60000).toISOString(),
          sla_breached: false
        });

      if (escalationError) throw escalationError;
      
      addNotification({
        type: 'alert_escalated',
        title: 'Alert Escalated',
        description: `Alert ${escalatingAlert.id} has been escalated to a new incident report.`,
        agentName: escalatingAlert.agent_name,
        alertId: escalatingAlert.id
      });

      // 3. Update Local State
      setAlerts(prev => prev.map(a => 
        a.id === escalatingAlert.id 
          ? { ...a, status: 'Escalated', has_report: !!newReport } 
          : a
      ));

      setEscalatingAlert(null);

      if (action === 'report' && newReport) {
        setEscalationSuccessReport(newReport);
      } else {
        // Navigate to escalations page
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'escalations' }));
      }
    } catch (error) {
      console.error('Escalation failed:', error);
      alert('Failed to escalate alert. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const confirmMergeToCase = async (caseId: string, isNew: boolean, caseTitle: string) => {
    if (selectedAlertIds.size === 0) {
      setDebugInfo('No alerts selected to merge.');
      return;
    }
    if (!supabase || !currentClient) {
      setDebugInfo(`Cannot merge: ${!supabase ? 'Supabase client not initialized' : 'No active client selected'}.`);
      return;
    }

    setLoading(true);
    setDebugInfo('Starting merge process...');
    let specificError: string | null = null;
    try {
      let targetCaseId = caseId;

      if (isNew) {
        console.log('Creating new case:', caseTitle);
        const clientId = currentClient?.id;
        
        console.log('Using client_id for new case:', clientId);
        
        // Create new case
        const caseData: any = {
          title: caseTitle,
          status: 'Open',
          severity: 'MEDIUM',
          client_id: clientId
        };

        const { data: newCase, error: caseError } = await supabase
          .from('cases')
          .insert(caseData)
          .select()
          .single();

        if (caseError) {
          console.error('Error creating case:', caseError);
          specificError = `Database Error (Creating Case): ${caseError.message} (Code: ${caseError.code}). Check if 'cases' table exists and has 'client_id' foreign key.`;
          throw caseError;
        }
        targetCaseId = newCase.id;
        console.log('New case created with ID:', targetCaseId);
      }

      console.log('Updating alerts with case_id:', targetCaseId, 'Alerts:', Array.from(selectedAlertIds));
      // Update alerts
      const { error: updateError, count } = await supabase
        .from('alerts')
        .update({ 
          status: 'Merged',
          case_id: targetCaseId
        }, { count: 'exact' })
        .in('id', Array.from(selectedAlertIds))
        .eq('client_id', currentClient.id);

      if (updateError) {
        console.error('Error updating alerts:', updateError);
        specificError = `Database Error (Updating Alerts): ${updateError.message} (Code: ${updateError.code})`;
        throw updateError;
      }

      if (count === 0) {
        console.warn('No alerts were updated in the database.');
        setDebugInfo('Warning: Alerts were not updated in the database. Check RLS policies for the "alerts" table.');
      } else {
        setDebugInfo(`Successfully merged ${count} alerts to case.`);
      }

      // Update local state
      setAlerts(prev => prev.map(a => selectedAlertIds.has(a.id) ? { 
        ...a, 
        status: 'Merged', 
        case_id: targetCaseId,
        cases: { title: caseTitle }
      } : a));
      setSelectedAlertIds(new Set());
      setIsMergeModalOpen(false);
      console.log('Merge successful');
    } catch (error: any) {
      console.error('Error merging to case:', error);
      if (specificError) {
        setDebugInfo(specificError);
      } else {
        const msg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        setDebugInfo(`Merge Error: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (filterSet: Set<string>, setFilterSet: (s: Set<string>) => void, value: string) => {
    const newSet = new Set(filterSet);
    if (value === 'ALL') {
      newSet.clear();
      newSet.add('ALL');
    } else {
      newSet.delete('ALL');
      if (newSet.has(value)) {
        newSet.delete(value);
        if (newSet.size === 0) newSet.add('ALL');
      } else {
        newSet.add(value);
      }
    }
    setFilterSet(newSet);
    setCurrentPage(1);
  };

  const activeFilterCount = [
    !severityFilter.has('ALL'),
    !statusFilter.has('ALL'),
    dateRange.start,
    dateRange.end,
    ipFilter,
    ruleFilter,
    caseFilter,
    caseIdFilter,
    agentFilter,
    classificationFilter !== 'ALL',
    intelFilter !== 'ALL'
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSeverityFilter(new Set(['ALL']));
    setStatusFilter(new Set(['ALL']));
    setSearchQuery('');
    setDateRange({ start: '', end: '' });
    setIpFilter('');
    setRuleFilter('');
    setCaseFilter('');
    setCaseIdFilter('');
    setAgentFilter('');
    setClassificationFilter('ALL');
    setIntelFilter('ALL');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalAlerts / pageSize);
  const paginatedAlerts = alerts;

  const correlatedGroups = alertGroups.filter(g => g.alert_count > 1);
  const standaloneGroups = alertGroups.filter(g => g.alert_count === 1);

  const stats = [
    { 
      label: 'Active Correlated', 
      value: alertGroups.filter(g => g.alert_count > 1 && g.status === 'Active').length, 
      icon: Layers, 
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'Standalone Alerts', 
      value: alertGroups.filter(g => g.alert_count === 1 && g.status === 'Active').length, 
      icon: Shield, 
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
    { 
      label: 'Closed Groups', 
      value: alertGroups.filter(g => g.status === 'Closed').length, 
      icon: CheckCircle2, 
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    { 
      label: 'Active Playbooks', 
      value: alertPlaybooks.filter(p => p.active).length, 
      icon: Zap, 
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    }
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollTop > 50;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide" onScroll={handleScroll}>
      {(closingAlert || isBulkClosing) && (
        <CloseAlertModal 
          alert={closingAlert || { id: 'Multiple', description: `${selectedAlertIds.size} alerts selected` } as any} 
          onClose={() => {
            setClosingAlert(null);
            setIsBulkClosing(false);
          }} 
          onConfirm={confirmCloseAlert} 
        />
      )}
      <CloseGroupModal 
        isOpen={isCloseGroupModalOpen}
        onClose={() => {
          setIsCloseGroupModalOpen(false);
          setSelectedGroup(null);
        }}
        onConfirm={handleCloseGroup}
        group={selectedGroup}
      />
      <MergeToCaseModal 
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        onConfirm={confirmMergeToCase}
        selectedCount={selectedAlertIds.size}
      />

      {/* Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Security Alerts</h2>
                  {debugInfo && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 font-mono">
                      {debugInfo}
                    </div>
                  )}
                  <p className="text-sm text-neutral-500 mt-1">
            {clientName ? `Monitoring Client: ${clientName}` : 'Wazuh Integration Active | Real-time monitoring and investigation'}
          </p>
        </div>
        
        <div className="flex items-center gap-1 bg-black border border-neutral-800 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('all')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              viewMode === 'all' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Shield className="w-4 h-4" />
            ALL ALERTS
          </button>
          <button 
            onClick={() => setViewMode('correlated')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              viewMode === 'correlated' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Layers className="w-4 h-4" />
            CORRELATED VIEW
          </button>
          <button 
            onClick={() => setViewMode('playbooks')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              viewMode === 'playbooks' ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <Zap className="w-4 h-4" />
            PLAYBOOKS
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-neutral-900/30 border border-neutral-800 p-4 rounded-2xl flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {viewMode === 'all' && (
        <>
          <div className="flex items-center justify-end gap-3">
            {selectedAlertIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 px-3 py-1.5 rounded-md mr-2"
              >
                <span className="text-[11px] font-bold text-blue-400">{selectedAlertIds.size} Selected</span>
                <div className="w-[1px] h-3 bg-blue-500/30 mx-1" />
                <button 
                  onClick={() => handleBulkStatusChange('Investigating')}
                  className="text-[10px] font-bold text-white hover:text-blue-400 transition-colors"
                >
                  INVESTIGATE
                </button>
                <button 
                  onClick={() => handleBulkStatusChange('Closed')}
                  className="text-[10px] font-bold text-white hover:text-red-400 transition-colors"
                >
                  CLOSE
                </button>
              </motion.div>
            )}
            <button 
              onClick={() => setIsMergeModalOpen(true)}
              className={cn(
                "px-4 py-2 rounded-md text-[12px] font-medium text-white transition-colors flex items-center gap-2",
                selectedAlertIds.size > 0 ? "bg-blue-600 hover:bg-blue-500" : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              )}
              disabled={selectedAlertIds.size === 0}
            >
              <Briefcase className="w-4 h-4" />
              {selectedAlertIds.size > 0 ? `Merge to Case (${selectedAlertIds.size})` : 'Merge to Case'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 bg-neutral-900/30 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text"
                  placeholder="Search alerts by description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              
              <button 
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold",
                  isFilterPanelOpen || activeFilterCount > 0
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700"
                )}
              >
                <Globe className="w-4 h-4" />
                FILTER
                {activeFilterCount > 0 && (
                  <span className="ml-1 bg-white text-blue-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={cn("w-4 h-4 transition-transform", isFilterPanelOpen && "rotate-180")} />
              </button>

              {activeFilterCount > 0 && (
                <button 
                  onClick={resetFilters}
                  className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                  RESET
                </button>
              )}
            </div>

            {/* Quick Filters: Severity & Status */}
            <div className="flex flex-wrap items-center gap-8 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity</span>
                <div className="flex items-center gap-1.5">
                  {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => toggleFilter(severityFilter, setSeverityFilter, sev)}
                      className={cn(
                        "px-3 py-1 rounded text-[10px] font-bold transition-all border",
                        severityFilter.has(sev) 
                          ? "bg-white border-white text-black" 
                          : "bg-black border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-700"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-[1px] h-4 bg-neutral-800 hidden md:block" />

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</span>
                <div className="flex items-center gap-1.5">
                  {['ALL', 'Active', 'Investigating', 'Escalated', 'Merged', 'Closed'].map((stat) => (
                    <button
                      key={stat}
                      onClick={() => toggleFilter(statusFilter, setStatusFilter, stat)}
                      className={cn(
                        "px-3 py-1 rounded text-[10px] font-bold transition-all border",
                        statusFilter.has(stat) 
                          ? "bg-white border-white text-black" 
                          : "bg-black border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-700"
                      )}
                    >
                      {stat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isFilterPanelOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Date Range */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Date Range</label>
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <input 
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                          />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <input 
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Source IP & Rule */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source IP</label>
                        <div className="relative">
                          <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
                          <input 
                            type="text"
                            placeholder="e.g. 192.168.1.1"
                            value={ipFilter}
                            onChange={(e) => setIpFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Wazuh Rule ID</label>
                        <div className="relative">
                          <Terminal className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
                          <input 
                            type="text"
                            placeholder="e.g. 5710"
                            value={ruleFilter}
                            onChange={(e) => setRuleFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Agent Name</label>
                        <div className="relative">
                          <Monitor className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <select 
                            value={agentFilter}
                            onChange={(e) => setAgentFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="">All Agents</option>
                            {availableAgents.map(agent => (
                              <option key={agent} value={agent}>{agent}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Threat Intel & Case */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Threat Intel</label>
                        <div className="relative">
                          <Zap className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <select 
                            value={intelFilter}
                            onChange={(e) => setIntelFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="ALL">All Reputations</option>
                            <option value="Malicious">Malicious</option>
                            <option value="Suspicious">Suspicious</option>
                            <option value="Clean">Clean</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Classification</label>
                        <div className="relative">
                          <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <select 
                            value={classificationFilter}
                            onChange={(e) => setClassificationFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="ALL">All Classifications</option>
                            <option value="True Positive">True Positive</option>
                            <option value="False Positive">False Positive</option>
                            <option value="Benign Positive">Benign Positive</option>
                            <option value="Testing">Testing</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Merge Status</label>
                        <div className="relative">
                          <Briefcase className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                          <select 
                            value={caseFilter}
                            onChange={(e) => setCaseFilter(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-lg pl-7 pr-8 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                          >
                            <option value="">All Alerts</option>
                            <option value="NONE">Not Merged</option>
                            <option value="ANY">Merged (Any Case)</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-black border border-neutral-800 rounded-xl">
            <div className="px-6 py-4 border-b border-neutral-800 bg-white/[0.01] flex items-center gap-4 rounded-t-xl">
              <button 
                onClick={toggleSelectAll}
                className="text-neutral-600 hover:text-blue-500 transition-colors"
              >
                {selectedAlertIds.size === paginatedAlerts.length && paginatedAlerts.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <div className="w-32 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Alert ID</div>
              <div className="w-40 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Timestamp</div>
              <div className="flex-1 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Description</div>
              <div className="w-24 text-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity</div>
              <div className="w-32 text-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</div>
              <div className="w-8"></div>
            </div>
            
            <div className="flex flex-col">
              {loading ? (
                <div className="p-20 text-center text-neutral-500 text-sm">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  Loading security events...
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                  <div className="text-neutral-500 text-sm">
                    No alerts matching your current filters.
                  </div>
                </div>
              ) : (
                paginatedAlerts.map((alert, index) => (
                  <AlertRow 
                    key={alert.id} 
                    alert={alert} 
                    isSelected={selectedAlertIds.has(alert.id)}
                    onSelect={() => toggleSelectAlert(alert.id)}
                    onStatusChange={(newStatus) => handleStatusChange(alert, newStatus)}
                    onEscalate={setEscalatingAlert}
                    sharedIntel={ipIntelCache[alert.source_ip]}
                    onIntelUpdate={async (intel) => {
                      setIpIntelCache(prev => ({ ...prev, [alert.source_ip]: intel }));
                      // Also update all alerts with the same IP in the current state for consistency
                      setAlerts(prev => prev.map(a => a.source_ip === alert.source_ip ? { ...a, threat_intel: intel } : a));
                      
                      // Persist to database for all alerts with this IP
                      if (supabase) {
                        try {
                          // Update all alerts with this IP
                          await supabase
                            .from('alerts')
                            .update({ threat_intel: intel })
                            .eq('source_ip', alert.source_ip);
                          
                          // Also update the global threat intel cache table
                          const { error: cacheError } = await supabase
                            .from('threat_intel_cache')
                            .upsert({
                              ip: alert.source_ip,
                              reputation: intel.reputation,
                              malicious: intel.malicious,
                              details: intel.details,
                              provider: intel.provider.replace(/\s*(\(Cached\)|API)/g, ''),
                              last_updated: new Date().toISOString()
                            }, { onConflict: 'ip' });
                          
                          if (cacheError) {
                            console.error('Cache persistence failed:', cacheError);
                            setDebugInfo(`Cache Error: ${cacheError.message} (${cacheError.code})`);
                          } else {
                            console.log('Cache persistence succeeded for IP:', alert.source_ip);
                          }
                        } catch (e) {
                          console.error('Database persistence failed:', e);
                          setDebugInfo(`Persistence Exception: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      }
                    }}
                    isFirst={index === 0}
                  />
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalAlerts > 0 && (
            <div className="flex items-center justify-between bg-neutral-900/30 p-4 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-6">
                <div className="text-[11px] text-neutral-500 font-medium">
                  Showing <span className="text-white">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-white">{(currentPage - 1) * pageSize + alerts.length}</span> of <span className="text-white">{totalAlerts}</span> alerts
                </div>
                
                <div className="flex items-center gap-2 border-l border-neutral-800 pl-6">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Show:</span>
                  <select 
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-black border border-neutral-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={12}>12</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 rounded-md border border-neutral-800 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let startPage = Math.max(1, currentPage - 2);
                      if (startPage + 4 > totalPages) {
                        startPage = Math.max(1, totalPages - 4);
                      }
                      // Ensure startPage is at least 1
                      startPage = Math.max(1, startPage);
                      const pageNum = startPage + i;
                      
                      // Double check we don't exceed totalPages
                      if (pageNum > totalPages) return null;
                      
                      return (
                        <button
                          key={`page-${pageNum}`}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "w-8 h-8 rounded-md text-[11px] font-bold transition-all",
                            currentPage === pageNum 
                              ? "bg-white text-black" 
                              : "text-neutral-500 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 rounded-md border border-neutral-800 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === 'correlated' && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold text-white">Correlated Alerts</h3>
              <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                {correlatedGroups.length} Groups
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {correlatedGroups.map(group => (
                <GroupCard 
                  key={group.id} 
                  group={group} 
                  playbook={alertPlaybooks.find(p => p.rule_id === group.rule_id && p.active)}
                  onExpand={() => {}} 
                  onClose={() => {
                    setSelectedGroup(group);
                    setIsCloseGroupModalOpen(true);
                  }}
                  onEscalate={() => {}}
                  onPlaybook={() => {
                    setSelectedGroup(group);
                    setIsCloseGroupModalOpen(true);
                  }}
                  onViewAlerts={handleViewAllAlerts}
                  onSelectAlert={(alert) => setSelectedAlertForModal(alert)}
                />
              ))}
              {correlatedGroups.length === 0 && (
                <div className="p-20 text-center bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl">
                  <p className="text-neutral-500 text-sm">No correlated alert groups found.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-bold text-white">Standalone Alerts</h3>
              <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                {standaloneGroups.length} Alerts
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {standaloneGroups.map(group => (
                <GroupCard 
                  key={group.id} 
                  group={group} 
                  playbook={alertPlaybooks.find(p => p.rule_id === group.rule_id && p.active)}
                  onExpand={() => {}} 
                  onClose={() => {
                    setSelectedGroup(group);
                    setIsCloseGroupModalOpen(true);
                  }}
                  onEscalate={() => {}}
                  onPlaybook={() => {
                    setSelectedGroup(group);
                    setIsCloseGroupModalOpen(true);
                  }}
                  onViewAlerts={handleViewAllAlerts}
                  onSelectAlert={(alert) => setSelectedAlertForModal(alert)}
                />
              ))}
              {standaloneGroups.length === 0 && (
                <div className="p-20 text-center bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl">
                  <p className="text-neutral-500 text-sm">No standalone alerts found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'playbooks' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-bold text-white">Auto-Playbooks</h3>
            </div>
            <p className="text-xs text-neutral-500">Active playbooks will automatically close matching alerts upon detection.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alertPlaybooks.map(playbook => (
              <PlaybookCard 
                key={playbook.id} 
                playbook={playbook} 
                onToggle={() => handleTogglePlaybook(playbook)}
                onDelete={() => handleDeletePlaybook(playbook.id)}
              />
            ))}
            {alertPlaybooks.length === 0 && (
              <div className="col-span-full p-20 text-center bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl">
                <Bot className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                <h4 className="text-white font-bold text-sm mb-2">No Playbooks Created</h4>
                <p className="text-neutral-500 text-xs max-w-xs mx-auto">
                  Create playbooks from the Correlated View to automate alert resolution.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Alert Details Modal */}
      <AlertDetailsModal 
        alert={selectedAlertForModal} 
        isOpen={!!selectedAlertForModal} 
        onClose={() => setSelectedAlertForModal(null)}
        onStatusChange={(newStatus) => {
          if (selectedAlertForModal) {
            handleStatusChange(selectedAlertForModal, newStatus);
            setSelectedAlertForModal(null);
          }
        }}
        onIntelUpdate={(alertId, intel) => {
          setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, threat_intel: intel } : a));
          if (selectedAlertForModal?.id === alertId) {
            setSelectedAlertForModal(prev => prev ? { ...prev, threat_intel: intel } : null);
          }
        }}
        onEscalate={() => selectedAlertForModal && handleEscalateDirect(selectedAlertForModal)}
        onGenerateReport={() => selectedAlertForModal && handleGenerateReport(selectedAlertForModal)}
      />
      {escalatingAlert && (
        <EscalationModal 
          isOpen={!!escalatingAlert}
          onClose={() => setEscalatingAlert(null)}
          onConfirm={handleEscalateConfirm}
          alert={escalatingAlert}
          isGenerating={isGeneratingReport}
        />
      )}

      <EscalationSuccessModal 
        isOpen={!!escalationSuccessReport}
        onClose={() => {
          if (escalationSuccessReport) {
            window.sessionStorage.setItem('nav_data', JSON.stringify({ openReportId: escalationSuccessReport.id }));
          }
          setEscalationSuccessReport(null);
          window.dispatchEvent(new CustomEvent('navigate', { detail: 'reports' }));
        }}
        report={escalationSuccessReport}
        clientName={clientName}
      />
    </div>
  );
}
