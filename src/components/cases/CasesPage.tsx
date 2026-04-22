import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Filter,
  User,
  Shield,
  Activity,
  MessageSquare,
  ArrowRight,
  MoreVertical,
  X,
  Target,
  FileText,
  AlertCircle,
  Hash,
  Info,
  History,
  Check,
  ExternalLink,
  PlusCircle,
  MoreHorizontal,
  Monitor
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { cn } from '../../lib/utils';
import { formatDistance as formatDistanceLib } from 'date-fns';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import type { Case, CaseEvent, CaseNote } from '../../types/cases';

// --- Sub-components ---

const SLAPressBar = ({ deadline, priority }: { deadline: string, priority: string }) => {
  const [timeLeft, setTimeLeft] = useState<{ label: string, percent: number, color: string, isBreached: boolean }>({
    label: '',
    percent: 100,
    color: 'bg-green-500',
    isBreached: false
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const dead = new Date(deadline);
      const created = new Date(dead.getTime() - (
        priority.includes('P1') ? 1 : 
        priority.includes('P2') ? 4 : 
        priority.includes('P3') ? 24 : 72
      ) * 60 * 60 * 1000);
      
      const total = dead.getTime() - created.getTime();
      const remain = dead.getTime() - now.getTime();
      const isBreached = remain <= 0;
      
      const percent = Math.max(0, Math.min(100, (remain / total) * 100));
      
      let color = 'bg-emerald-500';
      if (percent < 20) color = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      else if (percent < 50) color = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]';

      // Format human label
      let label = '';
      if (isBreached) {
        label = 'BREACHED';
      } else {
        const h = Math.floor(remain / (1000 * 60 * 60));
        const m = Math.floor((remain % (1000 * 60 * 60)) / (1000 * 60));
        label = `${h}h ${m}m remaining`;
      }

      setTimeLeft({ label, percent, color, isBreached });
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [deadline, priority]);

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
        <span className="text-neutral-500">SLA Performance</span>
        <span className={cn(timeLeft.isBreached ? "text-red-500" : "text-neutral-400")}>{timeLeft.label}</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${timeLeft.percent}%` }}
          className={cn("h-full transition-all duration-500", timeLeft.color)}
        />
      </div>
    </div>
  );
};

// --- Main Page Component ---

export default function CasesPage({ user: propUser }: { user?: any }) {
  const { currentClient, user: contextUser } = useClient();
  const user = propUser || contextUser;
  const [cases, setCases] = useState<Case[]>([]);
  const [viewMode, setViewMode] = useState<'queue' | 'detail'>('queue');
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!supabase || !currentClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases(data || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, [currentClient]);

  useEffect(() => {
    fetchCases();

    // Check for deep-linked case from navigation
    const navDataStr = window.sessionStorage.getItem('nav_data');
    if (navDataStr) {
      try {
        const { caseId } = JSON.parse(navDataStr);
        if (caseId) {
          // If we have the ID, we need to find it in the list (once loaded)
          const attemptOpen = () => {
            if (cases.length > 0) {
              const c = cases.find(cs => cs.id === caseId);
              if (c) {
                setActiveCase(c);
                setViewMode('detail');
                window.sessionStorage.removeItem('nav_data');
              }
            }
          };
          attemptOpen();
        }
      } catch (e) {
        console.error('Failed to parse nav data', e);
      }
    }

    if (!supabase || !currentClient) return;

    const channel = supabase.channel('cases_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases', filter: `client_id=eq.${currentClient.id}` },
        () => fetchCases()
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClient, fetchCases]);

  // SLA Breach Check
  useEffect(() => {
    if (!supabase || !currentClient || cases.length === 0) return;
    
    const checkSLA = async () => {
      const now = new Date();
      const breachedCases = cases.filter(c =>
        c.sla_deadline &&
        new Date(c.sla_deadline) < now &&
        !c.sla_breached &&
        c.status !== 'Resolved' &&
        c.status !== 'Closed'
      );

      for (const c of breachedCases) {
        await supabase.from('cases').update({ sla_breached: true }).eq('id', c.id);
        await supabase.from('case_events').insert({
          case_id: c.id, 
          client_id: currentClient.id,
          event_type: 'system_action',
          event_description: 'SLA deadline breached — case requires immediate attention',
          actor: 'system', 
          actor_type: 'system'
        });
      }
    };

    const interval = setInterval(checkSLA, 60000);
    return () => clearInterval(interval);
  }, [cases, currentClient]);

  const stats = {
    open: cases.filter(c => c.status === 'Open' || c.status === 'Investigating').length,
    slaBreached: cases.filter(c => c.sla_breached && c.status !== 'Resolved' && c.status !== 'Closed').length,
    resolvedToday: cases.filter(c => c.resolved_at && new Date(c.resolved_at).toDateString() === new Date().toDateString()).length,
    pendingVerdict: cases.filter(c => !c.verdict && c.status !== 'Closed' && c.status !== 'Resolved').length
  };

  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.source_ip?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'All') return matchesSearch;
    if (filter === 'SLA Breached') return matchesSearch && c.sla_breached;
    return matchesSearch && c.status === filter;
  });

  const handleOpenCase = (c: Case) => {
    setActiveCase(c);
    setViewMode('detail');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-hidden relative">
      <AnimatePresence>
        {viewMode === 'queue' ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto scrollbar-hide p-8 space-y-8"
          >
            {/* Header Area */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Case Management</h2>
                <p className="text-sm text-neutral-500 mt-1 uppercase tracking-widest font-bold text-[10px]">Context-First Investigation Queue</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  New Case
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Open Cases', value: stats.open, icon: Briefcase, color: 'text-blue-500' },
                { label: 'SLA Breached', value: stats.slaBreached, icon: AlertTriangle, color: stats.slaBreached > 0 ? 'text-red-500' : 'text-neutral-500' },
                { label: 'Resolved Today', value: stats.resolvedToday, icon: CheckCircle2, color: 'text-emerald-500' },
                { label: 'Pending Verdict', value: stats.pendingVerdict, icon: Clock, color: 'text-yellow-500' }
              ].map((s) => (
                <div key={s.label} className="bg-neutral-900/30 border border-neutral-800 p-6 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <s.icon className={cn("w-3 h-3", s.color)} />
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{s.label}</span>
                  </div>
                  <h3 className={cn("text-3xl font-bold tracking-tighter", s.label === 'SLA Breached' && s.value > 0 ? "text-red-500" : "text-white")}>
                    {s.value}
                  </h3>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-neutral-900/40 p-3 rounded-xl border border-neutral-800/60 shadow-xl">
              <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5 overflow-x-auto scrollbar-hide">
                {['All', 'Open', 'Investigating', 'Pending Review', 'Resolved', 'SLA Breached'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                      filter === f 
                        ? "bg-white text-black shadow-lg" 
                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <input 
                  type="text"
                  placeholder="ID, Title, Agent or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-neutral-600 font-medium"
                />
              </div>
            </div>

            {/* Case Cards Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 animate-pulse">Synchronizing Queue...</span>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-neutral-800 rounded-2xl">
                <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6">
                  <Briefcase className="w-10 h-10 text-neutral-800" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Secure Operations Centers</h3>
                <p className="text-neutral-500 text-sm max-w-sm mb-8 font-medium">No active cases matching your criteria. High-availability monitoring is operational.</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-white text-black px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95"
                >
                  Open First Case
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCases.map((c) => (
                  <CaseCard key={c.id} c={c} onClick={() => handleOpenCase(c)} />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <CaseDetailView 
            caseData={activeCase!} 
            onBack={() => setViewMode('queue')} 
            refresh={() => fetchCases()}
          />
        )}
      </AnimatePresence>

      {/* New Case Modal */}
      {isModalOpen && (
        <NewCaseModal 
          onClose={() => setIsModalOpen(false)} 
          onCreated={() => {
            setIsModalOpen(false);
            fetchCases();
          }} 
        />
      )}
    </div>
  );
}

const CaseCard = ({ c, onClick }: { c: Case, onClick: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={cn(
        "bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative group flex flex-col h-full",
        isHovered ? "border-white/20 bg-neutral-800/40 shadow-2xl translate-y-[-4px]" : ""
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-mono text-blue-500 font-bold uppercase tracking-widest">{c.case_number}</span>
          <h3 className="text-sm font-bold text-white leading-tight line-clamp-2 pr-4">{c.title}</h3>
        </div>
        <StatusPill status={c.status} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <SeverityBadge severity={c.severity} />
        <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
          {c.priority}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Agent</span>
          <p className="text-[11px] font-bold text-neutral-300 truncate">{c.agent_name || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Source IP</span>
          <p className="text-[11px] font-mono text-neutral-300 truncate">{c.source_ip || 'Internal'}</p>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2 text-neutral-500">
            <User className="w-3 h-3" />
            <span className="font-bold truncate max-w-[120px]">{c.assigned_to || 'UNASSIGNED'}</span>
          </div>
          <span className="text-neutral-600 font-medium">{new Date(c.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
        </div>

        <SLAPressBar deadline={c.sla_deadline} priority={c.priority} />
        
        <div className="pt-2 flex items-center justify-between">
          <button className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1 hover:text-white transition-colors">
            Open Case <ArrowRight className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-neutral-500 hover:text-white transition-all">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isHovered && (
        <motion.div 
          layoutId={`highlight-${c.id}`}
          className="absolute inset-0 border border-blue-500/30 rounded-2xl pointer-events-none" 
        />
      )}
    </motion.div>
  );
};

// --- Case Detail Components ---

const CaseDetailView = ({ caseData, onBack, refresh }: { caseData: Case, onBack: () => void, refresh: () => void }) => {
  const { currentClient, user } = useClient();
  const [activeTab, setActiveTab] = useState<'investigation' | 'timeline' | 'threat'>('investigation');
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedAlerts, setRelatedAlerts] = useState<any[]>([]);
  const [linkedAlert, setLinkedAlert] = useState<any>(null);
  const [verdictModal, setVerdictModal] = useState<{ open: boolean, verdict: string }>({ open: false, verdict: '' });
  const [verdictReason, setVerdictReason] = useState('');
  const [createPlaybook, setCreatePlaybook] = useState(false);
  const [generateReportAuto, setGenerateReportAuto] = useState(false);
  const [priorityModal, setPriorityModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!supabase || !currentClient) return;
    
    // Fetch info, notes, events, related alerts in parallel
    const [notesRes, eventsRes, alertRes, relatedRes] = await Promise.all([
      supabase.from('case_notes').select('*').eq('case_id', caseData.id).order('created_at', { ascending: false }),
      supabase.from('case_events').select('*').eq('case_id', caseData.id).order('created_at', { ascending: true }),
      caseData.alert_id ? supabase.from('alerts').select('*').eq('id', caseData.alert_id).single() : Promise.resolve({ data: null }),
      supabase.from('alerts').select('id, alert_number, description, severity, timestamp, agent_name')
        .eq('client_id', currentClient.id)
        .or(`rule_id.eq.${caseData.rule_id},source_ip.eq.${caseData.source_ip}`)
        .neq('id', caseData.alert_id)
        .order('timestamp', { ascending: false })
        .limit(10)
    ]);

    if (notesRes.data) setNotes(notesRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (alertRes.data) setLinkedAlert(alertRes.data);
    if (relatedRes.data) setRelatedAlerts(relatedRes.data);
  }, [caseData.id, caseData.alert_id, caseData.rule_id, caseData.source_ip, currentClient]);

  useEffect(() => {
    fetchData();

    // Real-time subscriptions
    const eventsSub = supabase.channel(`events_${caseData.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_events', filter: `case_id=eq.${caseData.id}` },
        () => fetchData()
      ).subscribe();

    const notesSub = supabase.channel(`notes_${caseData.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'case_notes', filter: `case_id=eq.${caseData.id}` },
        () => fetchData()
      ).subscribe();

    return () => {
      supabase.removeChannel(eventsSub);
      supabase.removeChannel(notesSub);
    };
  }, [caseData.id, fetchData]);

  const addNote = async () => {
    if (!newNote.trim() || !supabase || !user || !currentClient) return;
    setIsSubmitting(true);
    try {
      await supabase.from('case_notes').insert({
        case_id: caseData.id,
        client_id: currentClient.id,
        note: newNote,
        added_by: user.email
      });

      await supabase.from('case_events').insert({
        case_id: caseData.id,
        client_id: currentClient.id,
        event_type: 'note_added',
        event_description: `Analyst ${user.email.split('@')[0]} added investigation note`,
        actor: user.email,
        actor_type: 'analyst'
      });

      setNewNote('');
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!supabase || !user || !currentClient) return;
    try {
      setErrorFeedback(null);
      const { error } = await supabase.from('cases').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', caseData.id);
      if (error) throw error;
      
      await supabase.from('case_events').insert({
        case_id: caseData.id, client_id: currentClient.id,
        event_type: 'status_changed',
        event_description: `Status changed to ${newStatus}`,
        actor: user.email, actor_type: 'analyst'
      });
      refresh();
    } catch (err) {
      console.error('Error updating status:', err);
      setErrorFeedback(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const assignToSelf = async () => {
    if (!supabase || !user) return;
    try {
      setErrorFeedback(null);
      const { error } = await supabase.from('cases').update({ assigned_to: user.email }).eq('id', caseData.id);
      if (error) throw error;
      refresh();
    } catch (err) {
      console.error('Error assigning case:', err);
      setErrorFeedback(err instanceof Error ? err.message : 'Failed to assign case');
    }
  };

  const handleSetVerdict = async () => {
    if (!verdictReason || !supabase || !user || !currentClient) return;
    setIsSubmitting(true);
    try {
      // Update case
      await supabase.from('cases').update({
        verdict: verdictModal.verdict,
        verdict_reason: verdictReason,
        status: 'Resolved',
        resolved_at: new Date().toISOString(),
        closed_by: user.email,
        health_score: 100
      }).eq('id', caseData.id);

      // Add to timeline
      await supabase.from('case_events').insert({
        case_id: caseData.id, client_id: currentClient.id,
        event_type: 'verdict_set',
        event_description: `Verdict set: ${verdictModal.verdict} — ${verdictReason}`,
        actor: user.email, actor_type: 'analyst'
      });

      // Close linked alert if exists
      if (caseData.alert_id) {
        await supabase.from('alerts').update({
          status: 'Closed',
          resolution_type: verdictModal.verdict,
          resolution_notes: verdictReason,
          closed_by: user.email,
          closed_at: new Date().toISOString()
        }).eq('id', caseData.alert_id);
      }

      // Create playbook if checked
      if (createPlaybook && caseData.rule_id) {
        await supabase.from('alert_playbooks').upsert({
          client_id: currentClient.id,
          rule_id: caseData.rule_id,
          rule_description: caseData.title,
          auto_action: verdictModal.verdict === 'False Positive' ? 'close' : 'escalate',
          resolution_type: verdictModal.verdict,
          resolution_notes: verdictReason,
          created_by: user.email,
          active: true
        }, { onConflict: 'client_id,rule_id' });
      }

      setVerdictModal({ open: false, verdict: '' });
      refresh();
      onBack();
    } catch (err) {
      console.error('Error setting verdict:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateNarrative = (c: Case, alert: any) => {
    if (c.narrative) return c.narrative;
    const timeOpen = formatDistanceLib(new Date(c.created_at), new Date());
    return `On ${new Date(c.created_at).toLocaleString()}, a ${c.severity} severity alert was detected from ${c.agent_name || 'unknown agent'}${c.source_ip ? ' originating from IP ' + c.source_ip : ''}. This case has been open for ${timeOpen}. ${c.assigned_to ? 'Currently assigned to ' + c.assigned_to + '.' : 'Not yet assigned.'} ${c.verdict ? 'Verdict: ' + c.verdict + '.' : 'Verdict pending.'}`;
  };

  const updatePriority = async (newPriority: string) => {
    if (!supabase || !user || !currentClient) return;
    try {
      setErrorFeedback(null);
      const severity = newPriority.split(' - ')[1].toUpperCase();
      const { error } = await supabase.from('cases').update({ 
        priority: newPriority, 
        severity,
        updated_at: new Date().toISOString() 
      }).eq('id', caseData.id);
      if (error) throw error;

      await supabase.from('case_events').insert({
        case_id: caseData.id, client_id: currentClient.id,
        event_type: 'status_changed',
        event_description: `Priority updated to ${newPriority}`,
        actor: user.email, actor_type: 'analyst'
      });
      
      setPriorityModal(false);
      refresh();
    } catch (err) {
      console.error('Error updating priority:', err);
      setErrorFeedback(err instanceof Error ? err.message : 'Failed to update priority');
      setPriorityModal(false);
    }
  };

  const health = calculateHealth(caseData, notes, events);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-black z-50 flex flex-col"
    >
      {/* Detail Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-neutral-900/30 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-all active:scale-95"
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-blue-500 font-bold uppercase tracking-widest leading-none">{caseData.case_number}</span>
              <StatusPill status={caseData.status} />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-none mt-1">{caseData.title}</h2>
            {errorFeedback && <p className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{errorFeedback}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 pr-6 border-r border-white/5">
            <div className="text-right">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">SLA Status</p>
              <p className={cn("text-xs font-bold", caseData.sla_breached ? "text-red-500" : "text-emerald-500")}>
                {caseData.sla_breached ? 'EXPIRED' : 'WITHIN LIMITS'}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-white transition-all">
            <ExternalLink className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-white transition-all">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Narrative & Info */}
        <div className="flex-1 overflow-y-auto p-8 border-r border-white/5 space-y-8 scrollbar-hide">
          {/* AI Narrative */}
          <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-6 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-20">
              <Activity className="w-20 h-20 text-blue-500 -mr-8 -mt-8" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Autonomous Narrative Analysis</h3>
            </div>
            <p className="text-sm text-blue-100 font-medium leading-relaxed relative z-10 italic">
              "{generateNarrative(caseData, linkedAlert)}"
            </p>
          </div>

          {/* Case Info Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Identity & Priority</h3>
              <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-5 grid grid-cols-1 gap-4">
                <InfoItem label="Rule ID" value={caseData.rule_id || 'Global'} icon={Hash} />
                <InfoItem label="Severity" value={caseData.severity} icon={AlertCircle} isSeverity />
                <InfoItem label="Priority" value={caseData.priority} icon={Activity} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source Entity</h3>
              <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-5 grid grid-cols-1 gap-4">
                <InfoItem label="Agent Name" value={caseData.agent_name || 'Generic Service'} icon={Monitor} />
                <InfoItem label="Source IP" value={caseData.source_ip || 'Internal System'} icon={Target} />
                <InfoItem label="Assigned To" value={caseData.assigned_to || 'UNASSIGNED'} icon={User} />
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Lifecycle Health</h3>
              <span className={cn("text-xs font-bold", health >= 80 ? "text-emerald-500" : health >= 40 ? "text-yellow-500" : "text-red-500")}>
                {health}% COMPLETE
              </span>
            </div>
            <div className="bg-neutral-900/30 border border-white/5 rounded-2xl p-6">
              <div className="h-1.5 w-full bg-white/5 rounded-full mb-6 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${health}%` }}
                  className={cn("h-full transition-all duration-1000", health >= 80 ? "bg-emerald-500" : health >= 40 ? "bg-yellow-500" : "bg-red-500")}
                />
              </div>
              <div className="grid grid-cols-2 gap-y-3">
                <HealthCheck label="Alert Linked" checked={!!caseData.alert_id} />
                <HealthCheck label="Analyst Assigned" checked={!!caseData.assigned_to} />
                <HealthCheck label="Investigation Notes" checked={notes.length > 0} />
                <HealthCheck label="Source IOC Identified" checked={!!caseData.source_ip} />
                <HealthCheck label="Final Verdict Set" checked={!!caseData.verdict} />
                <HealthCheck label="Incident Report Generated" checked={!!caseData.report_id} />
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Evidence Timeline */}
        <div className="w-[380px] overflow-y-auto p-8 border-r border-white/5 scrollbar-hide space-y-10">
          <div>
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-6">Evidence Timeline</h3>
            <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
              {events.map((e, idx) => (
                <TimelineEvent key={e.id} event={e} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Related Clusters ({relatedAlerts.length})</h3>
              <PlusCircle className="w-3 h-3 text-neutral-600 cursor-pointer hover:text-white transition-colors" />
            </div>
            <div className="space-y-3">
              {relatedAlerts.length === 0 ? (
                <p className="text-[11px] text-neutral-600 italic font-medium">No related behavioral overlaps found.</p>
              ) : (
                relatedAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-start justify-between group hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-neutral-300 leading-tight group-hover:text-white">{alert.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-mono text-neutral-600 uppercase font-bold">{alert.alert_number}</span>
                        <SeverityBadge severity={alert.severity} />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-blue-500 transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Actions & Notes */}
        <div className="w-[420px] overflow-y-auto p-8 bg-neutral-900/[0.15] scrollbar-hide flex flex-col">
          <div className="space-y-10 flex-1">
            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Orchestration Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton 
                  label="Take Case" 
                  icon={User} 
                  onClick={assignToSelf} 
                  disabled={caseData.assigned_to === user?.email}
                  className={caseData.assigned_to === user?.email ? "bg-neutral-800 text-neutral-600 border-none" : "bg-blue-600 text-white border-none hover:bg-blue-500"}
                />
                <ActionButton 
                  label="Investigating" 
                  icon={Activity} 
                  onClick={() => updateStatus('Investigating')}
                  disabled={caseData.status === 'Investigating'}
                />
                <ActionButton label="Generate Report" icon={FileText} onClick={() => setReportModal(true)} />
                <ActionButton label="Change Priority" icon={AlertCircle} onClick={() => setPriorityModal(true)} />
              </div>
            </div>

            {/* Investigation Notes */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Documentation</h3>
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl relative">
                    <p className="text-[12px] text-neutral-400 leading-relaxed font-medium mb-4">{note.note}</p>
                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-neutral-800 flex items-center justify-center">
                          <User className="w-2.5 h-2.5 text-neutral-400" />
                        </div>
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{note.added_by.split('@')[0]}</span>
                      </div>
                      <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">
                        {new Date(note.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Quick Actions at Bottom of Column */}
          <div className="mt-10 space-y-8">
            <div className="space-y-3">
              <textarea 
                placeholder="Add investigation findings..."
                className="w-full bg-black border border-white/5 rounded-xl p-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-24 placeholder:text-neutral-700 resize-none font-medium"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button 
                onClick={addNote}
                disabled={!newNote.trim() || isSubmitting}
                className="w-full py-3 bg-white text-black rounded-xl text-[11px] font-bold uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-20"
              >
                {isSubmitting ? 'Syncing...' : 'Append to Evidence'}
              </button>
            </div>

            {/* Decision Assistant */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-red-500/50 opacity-20" />
               <h3 className="text-sm font-bold text-white mb-2 tracking-tight">Decision Assistant</h3>
               <p className="text-[10px] text-neutral-500 font-medium mb-6">Automated workflows will trigger based on your selection.</p>
               
               <div className="grid grid-cols-2 gap-2">
                 <VerdictButton label="True Positive" verdict="True Positive" color="bg-red-500/10 text-red-500 border-red-500/20" onClick={() => setVerdictModal({ open: true, verdict: 'True Positive' })} />
                 <VerdictButton label="False Positive" verdict="False Positive" color="bg-emerald-500/10 text-emerald-500 border-emerald-500/20" onClick={() => setVerdictModal({ open: true, verdict: 'False Positive' })} />
                 <VerdictButton label="Benign Activity" verdict="Benign" color="bg-blue-500/10 text-blue-500 border-blue-500/20" onClick={() => setVerdictModal({ open: true, verdict: 'Benign' })} />
                 <VerdictButton label="Escalate" verdict="Escalated" color="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" onClick={() => setVerdictModal({ open: true, verdict: 'Escalated' })} />
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Modal */}
      <AnimatePresence>
        {priorityModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPriorityModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <h3 className="text-xl font-bold text-white tracking-tight">Adjust Priority</h3>
              <div className="space-y-2">
                {['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low'].map(p => (
                  <button
                    key={p}
                    onClick={() => updatePriority(p)}
                    className={cn(
                      "w-full py-4 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all",
                      caseData.priority === p ? "bg-white text-black border-white" : "bg-black/40 text-neutral-400 border-neutral-800 hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReportModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-bold text-white tracking-tight">Generate Incident Report</h3>
              </div>
              <p className="text-sm text-neutral-400 font-medium">A forensic summary of ID: <span className="text-blue-500 font-mono">{caseData.case_number}</span> will be compiled for management and regulatory review.</p>
              
              <div className="space-y-3 pt-4">
                <div className="p-4 bg-black rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Format</span>
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">PDF (Encrypted)</span>
                </div>
                <div className="p-4 bg-black rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Events Captured</span>
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">{events.length} Data Points</span>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setReportModal(false)} className="flex-1 py-4 text-neutral-500 font-bold uppercase text-[10px]">Close</button>
                <button 
                  onClick={() => {
                    setReportModal(false);
                    refresh();
                    // In a real app we would trigger a download or server-side PDF generation
                    console.log('Incident report generated for case:', caseData.case_number);
                  }}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest"
                >
                  Download Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {verdictModal.open && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVerdictModal({ open: false, verdict: '' })}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tighter uppercase">Resolve Investigation</h2>
                <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Setting verdict as: <span className="text-blue-500">{verdictModal.verdict}</span></p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Resolution Summary (Required)</label>
                  <textarea 
                    placeholder="Briefly explain the reasoning for this verdict..."
                    className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-600 h-32 placeholder:text-neutral-700 resize-none font-medium"
                    value={verdictReason}
                    onChange={(e) => setVerdictReason(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                   <Checkbox 
                     label="Create auto-playbook (auto-resolve future identical alerts)" 
                     checked={createPlaybook} 
                     onChange={(c) => setCreatePlaybook(c)} 
                   />
                   <Checkbox 
                     label="Generate detailed incident report automatically" 
                     checked={generateReportAuto} 
                     onChange={(c) => setGenerateReportAuto(c)} 
                   />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setVerdictModal({ open: false, verdict: '' })}
                  className="flex-1 py-4 text-neutral-500 font-bold uppercase tracking-widest hover:text-white transition-colors text-[11px]"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSetVerdict}
                  disabled={!verdictReason.trim() || isSubmitting}
                  className="flex-[2] py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-[11px] active:scale-95 transition-all shadow-xl disabled:opacity-20"
                >
                  {isSubmitting ? 'Finalizing...' : 'Close Case & Resolve'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Helper Components ---

const InfoItem = ({ label, value, icon: Icon, isSeverity = false }: any) => (
  <div className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-neutral-600" />
      <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{label}</span>
    </div>
    {isSeverity ? <SeverityBadge severity={value} /> : <span className={cn("text-xs font-bold text-white tracking-tight", label === 'Priority' && "text-blue-500")}>{value}</span>}
  </div>
);

const HealthCheck = ({ label, checked }: any) => (
  <div className="flex items-center gap-2.5">
    <div className={cn(
      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
      checked ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-white/5 border-white/5 text-neutral-700"
    )}>
      {checked ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
    </div>
    <span className={cn("text-[10px] font-bold uppercase tracking-widest", checked ? "text-neutral-300" : "text-neutral-600")}>{label}</span>
  </div>
);

const TimelineEvent = ({ event }: { event: CaseEvent }) => {
  const config: any = {
    alert_linked: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/20' },
    analyst_action: { icon: User, color: 'text-blue-500', bg: 'bg-blue-500/20' },
    system_action: { icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/20' },
    note_added: { icon: MessageSquare, color: 'text-neutral-400', bg: 'bg-white/10' },
    status_changed: { icon: History, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    verdict_set: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    case_created: { icon: Plus, color: 'text-blue-500', bg: 'bg-blue-500/20' }
  };

  const style = config[event.event_type] || config.system_action;

  return (
    <div className="relative pl-8 group">
      <div className={cn(
        "absolute left-1 top-0 w-4 h-4 rounded-md border border-white/10 flex items-center justify-center z-10 transition-transform group-hover:scale-125 bg-black",
        style.color
      )}>
        <style.icon className="w-2.5 h-2.5" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-bold text-neutral-300 group-hover:text-white transition-colors">{event.event_description}</p>
        <div className="flex items-center gap-2 text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
          <span className={cn(event.actor_type === 'system' ? "text-blue-500" : "text-white")}>{event.actor.split('@')[0]}</span>
          <span>•</span>
          <span>{new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ label, icon: Icon, onClick, disabled, className }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all text-neutral-400 hover:text-white disabled:opacity-20 active:scale-95",
      className
    )}
  >
    <Icon className="w-4 h-4" />
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

const VerdictButton = ({ label, verdict, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "p-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest text-center transition-all hover:scale-105 active:scale-95 shadow-lg",
      color
    )}
  >
    {label}
  </button>
);

const Checkbox = ({ label, checked, onChange }: any) => (
  <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors group">
    <div className={cn(
      "w-5 h-5 rounded-lg border flex items-center justify-center transition-all",
      checked ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-700 bg-black group-hover:border-neutral-500"
    )}>
      {checked && <Check className="w-3 h-3" />}
    </div>
    <span className="text-[11px] font-medium text-neutral-300">{label}</span>
    <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

// --- New Case Modal ---

const NewCaseModal = ({ onClose, onCreated }: any) => {
  const { currentClient, user } = useClient();
  const [formData, setFormData] = useState({
    title: '',
    alert_id: '',
    priority: 'P2 - High',
    severity: 'HIGH',
    assigned_to: '',
    description: ''
  });
  const [openAlerts, setOpenAlerts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!supabase || !currentClient) return;
      const { data } = await supabase
        .from('alerts')
        .select('id, alert_number, description, severity, agent_name, source_ip')
        .eq('client_id', currentClient.id)
        .eq('status', 'Active')
        .order('timestamp', { ascending: false })
        .limit(50);
      if (data) setOpenAlerts(data);
    };
    fetchAlerts();
  }, [currentClient]);

  const createCase = async () => {
    if (!formData.title || !supabase || !user || !currentClient) return;
    setIsSubmitting(true);
    try {
      const slaHours: any = { 'P1 - Critical': 1, 'P2 - High': 4, 'P3 - Medium': 24, 'P4 - Low': 72 };
      const deadline = new Date(Date.now() + (slaHours[formData.priority] || 24) * 60 * 60 * 1000);

      let alertData = null;
      if (formData.alert_id) {
        alertData = openAlerts.find(a => a.id === formData.alert_id);
      }

      const { data: newCase, error: caseErr } = await supabase.from('cases').insert({
        title: formData.title,
        description: formData.description,
        status: 'Open',
        severity: formData.severity,
        priority: formData.priority,
        client_id: currentClient.id,
        alert_id: formData.alert_id || null,
        agent_name: alertData?.agent_name || null,
        source_ip: alertData?.source_ip || null,
        rule_id: alertData?.rule_id || null,
        assigned_to: formData.assigned_to || null,
        sla_deadline: deadline.toISOString(),
        sla_breached: false,
        escalated_by: user.email,
        escalated_at: new Date().toISOString()
      }).select().single();

      if (caseErr) throw caseErr;

      // Event
      await supabase.from('case_events').insert({
        case_id: newCase.id,
        client_id: currentClient.id,
        event_type: 'case_created',
        event_description: `Case created by ${user.email}`,
        actor: user.email,
        actor_type: 'analyst',
        metadata: { alert_id: formData.alert_id, priority: formData.priority }
      });

      if (formData.alert_id) {
        await supabase.from('case_events').insert({
          case_id: newCase.id, client_id: currentClient.id,
          event_type: 'alert_linked',
          event_description: `Alert ${alertData?.alert_number || formData.alert_id} linked to case`,
          actor: 'system', actor_type: 'system'
        });
      }

      onCreated();
    } catch (err) {
      console.error('Error creating case:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl space-y-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tighter uppercase">Initiate Investigation</h2>
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Advanced Forensic Container</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-neutral-500 transition-all hover:rotate-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Narrative Title *</label>
              <input 
                placeholder="Suspicious Beaconing from DC-01"
                className="w-full bg-black border border-neutral-800 rounded-xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Link Primary Alert</label>
              <select 
                className="w-full bg-black border border-neutral-800 rounded-xl px-5 py-4 text-sm text-white focus:outline-none appearance-none cursor-pointer"
                value={formData.alert_id}
                onChange={(e) => setFormData(prev => ({ ...prev, alert_id: e.target.value }))}
              >
                <option value="">Unlinked Manual Case</option>
                {openAlerts.map(a => (
                  <option key={a.id} value={a.id}>[{a.alert_number}] {a.description}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Investigation Priority</label>
              <div className="grid grid-cols-2 gap-2">
                {['P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low'].map(p => (
                  <button
                    key={p}
                    onClick={() => setFormData(prev => ({ ...prev, priority: p as any, severity: p.split(' - ')[1].toUpperCase() }))}
                    className={cn(
                      "py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                      formData.priority === p ? "bg-white text-black border-white" : "bg-black/40 text-neutral-600 border-neutral-800 hover:text-white"
                    )}
                  >
                    {p.split(' - ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Lead Analyst (Email)</label>
              <input 
                placeholder="analyst@kastron-security.com"
                className="w-full bg-black border border-neutral-800 rounded-xl px-5 py-4 text-sm text-white focus:outline-none focus:border-blue-500"
                value={formData.assigned_to}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Initial Context</label>
              <textarea 
                placeholder="Initial observations and investigation scope..."
                className="w-full bg-black border border-neutral-800 rounded-xl px-5 py-4 text-sm text-white focus:outline-none h-36 resize-none"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <button 
          onClick={createCase}
          disabled={!formData.title || isSubmitting}
          className="w-full py-5 bg-white text-black rounded-2xl font-bold uppercase tracking-[0.2em] text-[12px] shadow-2xl shadow-blue-500/10 hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-20 mt-4"
        >
          {isSubmitting ? 'Finalizing Container...' : 'Establish Case Container'}
        </button>
      </motion.div>
    </div>
  );
};

// --- Utils ---

function formatDistance(earlier: Date, later: Date) {
  const diff = later.getTime() - earlier.getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function calculateHealth(caseData: Case, notes: CaseNote[], events: CaseEvent[]) {
  let score = 0;
  if (caseData.alert_id) score += 20;
  if (caseData.assigned_to) score += 15;
  if (notes.length > 0) score += 20;
  if (caseData.source_ip) score += 10;
  if (caseData.verdict) score += 25;
  if (caseData.report_id) score += 10;
  return Math.min(score, 100);
}
