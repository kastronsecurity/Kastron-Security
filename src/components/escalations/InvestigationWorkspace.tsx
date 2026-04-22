import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  X, Shield, ShieldAlert, Zap, Search, Activity, Clock, User, 
  ChevronRight, Copy, Code, List, Star, MessageSquare, Anchor, 
  ShieldCheck, Globe, Database, Terminal, AlertTriangle, CheckCircle2,
  MoreVertical, Share2, Printer, Download, Save, Check, Filter,
  ArrowRight, Play, Info, Layers, RefreshCw, FileText, Mail,
  Plus, ExternalLink, Trash2, Edit3, Clipboard, Map, Eye, Target, Sparkles,
  ArrowLeftCircle, AlertCircle, Radar, TrendingUp, Cpu, ChevronDown,
  Briefcase, MousePointerClick, Bell, ChevronLeft, Server, GitBranch
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeverityBadge, StatusPill } from '../ui/StatusElements';
import { LogViewer } from '../ui/LogViewer';
import { generateAINarrative } from '../../lib/gemini';
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
  onAddChecklistItem: (label: string) => void;
  onRemoveChecklistItem: (id: string) => void;
}

const ParsedLogTable: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  
  const raw = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch(e) { return data; } })() : data;
  
  if (typeof raw !== 'object' || raw === null) {
    return <div className="p-4 text-[10px] font-mono text-neutral-400 break-all">{String(raw)}</div>;
  }

  // Flatten the object for a strictly 2-column view
  const flatten = (obj: any, prefix = ''): Record<string, any> => {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flatten(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const flatData = flatten(raw);
  const entries = Object.entries(flatData);

  return (
    <div className="w-full bg-black/40 rounded-xl border border-neutral-900 overflow-hidden">
      <table className="w-full border-collapse table-fixed">
        <tbody className="divide-y divide-neutral-900">
          {entries.map(([key, value]) => (
            <tr key={key} className="hover:bg-white/[0.02] transition-colors group">
              <td className="py-2.5 px-4 bg-neutral-900/20 w-1/3 border-r border-neutral-900 align-top">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block truncate" title={key}>
                  {key}
                </span>
              </td>
              <td className="py-2.5 px-4 align-top">
                <span className="text-[10px] font-mono text-neutral-400 break-all leading-relaxed transition-colors group-hover:text-neutral-200">
                  {Array.isArray(value) ? JSON.stringify(value) : String(value)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const InvestigationWorkspace: React.FC<WorkspaceProps> = ({
  esc, workspace, data, loading, onClose, onRunThreatIntel, onAddAlertAsEvidence,
  onAddNote, onToggleKeyFinding, onAddEvidence, onChecklistUpdate,
  onGenerateReport, onBlockIP, onAddCurrentFindingsAsEvidence, onShowVerdict,
  onAddChecklistItem, onRemoveChecklistItem
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
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<any>(null);
  const [entityDrift, setEntityDrift] = useState<any>(null);
  const [incidentStory, setIncidentStory] = useState<any>(workspace?.ai_narrative || null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [showCreateCasePopup, setShowCreateCasePopup] = useState(false);
  const [newCheckItemLabel, setNewCheckItemLabel] = useState('');
  const [isAddingCheckItem, setIsAddingCheckItem] = useState(false);
  const [showEntityBehaviorPopup, setShowEntityBehaviorPopup] = useState(false);
  const [showCorrelatedPopup, setShowCorrelatedPopup] = useState(false);
  const [correlatedPopupTab, setCorrelatedPopupTab] = useState<'groups' | 'alerts'>('groups');
  const [selectedCorrelatedItem, setSelectedCorrelatedItem] = useState<any>(null);
  const [groupAlerts, setGroupAlerts] = useState<any[]>([]);
  const [groupAlertsLoading, setGroupAlertsLoading] = useState(false);
  const [logViewMode, setLogViewMode] = useState<'parsed' | 'raw'>('parsed');
  const [caseTitle, setCaseTitle] = useState('');
  const [casePriority, setCasePriority] = useState('P2 - High');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseCreated, setCaseCreated] = useState<any>(null);

  const [incidentTimeline, setIncidentTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [timelineFilter, setTimelineFilter] = useState<'pre' | 'trigger' | 'post' | 'all'>('all');
  const [selectedTimelineAlert, setSelectedTimelineAlert] = useState<any>(null);
  const [showTimelineAlertPopup, setShowTimelineAlertPopup] = useState(false);
  const [ipHistoryExpanded, setIpHistoryExpanded] = useState(false);
  const [iocInput, setIocInput] = useState('');
  const [iocSearchLoading, setIocSearchLoading] = useState(false);
  const [iocSearchResult, setIocSearchResult] = useState<any>(null);

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchSeverity, setGlobalSearchSeverity] = useState('All');
  const [globalSearchStatus, setGlobalSearchStatus] = useState('All');
  const [globalSearchTimeframe, setGlobalSearchTimeframe] = useState('All');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [selectedGlobalAlert, setSelectedGlobalAlert] = useState<any>(null);

  const { currentClient } = useClient();
  const { addNotification } = useNotifications();

  const getSourceIp = (alert: any) => {
    if (!alert) return 'N/A';
    if (alert.source_ip && alert.source_ip !== 'N/A') return alert.source_ip;
    
    // Try to extract from raw log
    const raw = typeof alert.raw_log === 'string' 
      ? (() => { try { return JSON.parse(alert.raw_log) } catch { return null } })()
      : alert.raw_log;
      
    if (!raw) return 'N/A';

    // Deep search for source IP patterns
    const findIP = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null;
      
      // Common Wazuh/Security fields
      const candidates = [
        obj.srcip, obj.src_ip, obj.source_ip, 
        obj.data?.srcip, obj.data?.src_ip, obj.data?.source_ip,
        obj.origin?.ip, obj.client?.ip
      ];
      
      for (const val of candidates) {
        if (typeof val === 'string' && val !== 'N/A' && val.includes('.')) return val;
      }
      
      return null;
    };

    return findIP(raw) || 'N/A';
  };

  const fetchIncidentTimeline = async (linkedAlert: any) => {
    if (!linkedAlert || !currentClient) return [];
    setTimelineLoading(true);

    const alertTime = new Date(linkedAlert.timestamp);
    const windowStart = new Date(alertTime.getTime() - 6 * 60 * 60 * 1000).toISOString(); // 6 hours before
    const windowEnd = new Date(alertTime.getTime() + 6 * 60 * 60 * 1000).toISOString();   // 6 hours after

    let timelineAlerts: any[] = [];

    // Query 0: Always fetch the trigger alert itself
    const { data: triggerData } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', linkedAlert.id)
      .single();
    
    if (triggerData) timelineAlerts.push(triggerData);
    else timelineAlerts.push(linkedAlert);

    // Strategy 1: Aggressive Agent Matching (Temporal Window)
    if (linkedAlert.agent_name) {
      const agentPrefix = linkedAlert.agent_name.split(/[.\s-]/)[0];
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', currentClient.id)
        .ilike('agent_name', `%${agentPrefix}%`)
        .gte('timestamp', windowStart)
        .lte('timestamp', windowEnd)
        .order('timestamp', { ascending: true })
        .limit(100);
      if (data) timelineAlerts.push(...data);
    }

    // Strategy 2: Absolute Temporal Neighbors (Regardless of correlation)
    // This catches alerts that might be related but have no shared metadata (e.g. pivoting)
    const { data: neighborsBefore } = await supabase
      .from('alerts')
      .select('*')
      .eq('client_id', currentClient.id)
      .lt('timestamp', linkedAlert.timestamp)
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (neighborsBefore) timelineAlerts.push(...neighborsBefore);

    const { data: neighborsAfter } = await supabase
      .from('alerts')
      .select('*')
      .eq('client_id', currentClient.id)
      .gt('timestamp', linkedAlert.timestamp)
      .order('timestamp', { ascending: true })
      .limit(10);
    
    if (neighborsAfter) timelineAlerts.push(...neighborsAfter);

    // Strategy 3: Same source_ip (Temporal Window)
    if (linkedAlert.source_ip && linkedAlert.source_ip !== 'N/A' && linkedAlert.source_ip !== 'Internal') {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', currentClient.id)
        .eq('source_ip', linkedAlert.source_ip)
        .gte('timestamp', windowStart)
        .lte('timestamp', windowEnd)
        .order('timestamp', { ascending: true })
        .limit(100);
      if (data) timelineAlerts.push(...data);
    }

    // Strategy 4: Same rule_id (Last 24 hours)
    if (linkedAlert.rule_id) {
      const dayAgo = new Date(alertTime.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('client_id', currentClient.id)
        .eq('rule_id', linkedAlert.rule_id)
        .gte('timestamp', dayAgo)
        .lte('timestamp', windowEnd)
        .order('timestamp', { ascending: true })
        .limit(50);
      if (data) timelineAlerts.push(...data);
    }

    // Deduplicate
    const seen = new Set();
    timelineAlerts = timelineAlerts.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    // Sort by timestamp ascending
    timelineAlerts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    setTimelineLoading(false);
    return timelineAlerts;
  };

  const handleIOCSearch = async () => {
    if (!iocInput.trim()) return;
    setIocSearchLoading(true);
    setIocSearchResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/threat-intel/ioc/${encodeURIComponent(iocInput.trim())}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 404 && text.includes('<!DOCTYPE')) {
          throw new Error("Backend API not found. This application requires a full-stack environment (like Cloud Run) to run the threat intelligence server. Netlify only supports static files.");
        }
        throw new Error(`Intelligence server error (${response.status})`);
      }
      
      const result = await response.json();
      setIocSearchResult({ ...result, ioc: iocInput.trim() });
      if (result.reputation === 'Malicious') {
        addNotification({
          type: 'critical',
          title: 'Malicious IOC',
          description: `External intelligence confirms ${iocInput.trim()} is MALICIOUS`
        });
      } else {
        addNotification({
          type: 'rule_deployed',
          title: 'Search Complete',
          description: `Intel found for ${iocInput.trim()}`
        });
      }
    } catch (e) {
      console.error("IOC Search failed:", e);
      addNotification({
        type: 'medium',
        title: 'Search Error',
        description: 'Intelligence search failed. Check connectivity.'
      });
    } finally {
      setIocSearchLoading(false);
    }
  };

  const handleGlobalAlertSearch = async () => {
    if (!currentClient) return;
    setIsSearchingGlobal(true);
    try {
      let queryBuilder = supabase.from('alerts')
        .select('*')
        .eq('client_id', currentClient.id);
      
      if (globalSearchSeverity !== 'All') {
        queryBuilder = queryBuilder.eq('severity', globalSearchSeverity);
      }

      if (globalSearchStatus !== 'All') {
        queryBuilder = queryBuilder.eq('status', globalSearchStatus);
      }

      if (globalSearchTimeframe !== 'All') {
        const now = new Date();
        let cutoff = new Date();
        if (globalSearchTimeframe === '24h') cutoff.setHours(now.getHours() - 24);
        else if (globalSearchTimeframe === '7d') cutoff.setDate(now.getDate() - 7);
        else if (globalSearchTimeframe === '30d') cutoff.setDate(now.getDate() - 30);
        queryBuilder = queryBuilder.gte('timestamp', cutoff.toISOString());
      }
      
      if (globalSearchQuery) {
        queryBuilder = queryBuilder.or(`description.ilike.%${globalSearchQuery}%,source_ip.ilike.%${globalSearchQuery}%,rule_id.ilike.%${globalSearchQuery}%`);
      }

      const { data: results, error } = await queryBuilder.limit(50).order('timestamp', { ascending: false });
      if (error) throw error;
      setGlobalSearchResults(results || []);
    } catch (err) {
      console.error("Global search failed:", err);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const handleAddAlertFromSearchAsEvidence = (alert: any) => {
    onAddAlertAsEvidence(alert);
    addNotification({
      type: 'rule_deployed',
      title: 'Evidence Added',
      description: `Alert ${alert.alert_number || alert.id.slice(0,8)} captured from search results.`
    });
  };

  const addIOCAsEvidence = () => {
    if (!iocSearchResult) return;
    onAddEvidence(
      'ioc',
      `IOC Intel: ${iocSearchResult.ioc}`,
      `${iocSearchResult.provider} Report: ${iocSearchResult.details} (Reputation: ${iocSearchResult.reputation})`,
      iocSearchResult.malicious ? 'High' : 'Medium'
    );
    addNotification({
      type: 'rule_deployed',
      title: 'Evidence Added',
      description: 'Intelligence report saved as evidence'
    });
  };

  useEffect(() => {
    if (data.linkedAlert) {
      fetchIncidentTimeline(data.linkedAlert).then(results => {
        setIncidentTimeline(results);
      });
    }
  }, [data.linkedAlert, currentClient]);

  const showSuccessToast = (message: string) => {
    addNotification({
      type: 'rule_deployed',
      title: 'Success',
      description: message
    });
  };

  const showWarningToast = (message: string) => {
    addNotification({
      type: 'medium',
      title: 'Warning',
      description: message
    });
  };

  const navigate = (path: string, state?: any) => {
    // Replaced with in-workspace popups where applicable
    if (path === '/entities') {
      setShowEntityBehaviorPopup(true);
    } else {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { 
          page: path.replace('/', ''), 
          data: state?.state 
        } 
      }));
    }
  };

  // Initialize case form when popup opens
  useEffect(() => {
    if (showCreateCasePopup && esc) {
      setCaseTitle(esc.title || '');
      setCaseDescription(`Investigation case created from escalation ${esc.escalation_id}. ${(data.notes || []).filter((n: any) => n.is_key_finding).map((n: any) => n.note).join(' ')}`);
      setCasePriority(esc.priority || 'P2 - High');
    }
  }, [showCreateCasePopup, esc, data.notes]);

  // Reset selected item when tab changes
  useEffect(() => {
    setSelectedCorrelatedItem(null);
    setGroupAlerts([]);
  }, [correlatedPopupTab]);

  useEffect(() => {
    const fetchGroupAlerts = async () => {
      if (!selectedCorrelatedItem || correlatedPopupTab !== 'groups' || !currentClient) return;
      setGroupAlertsLoading(true);
      try {
        const { data: alerts } = await supabase
          .from('alerts')
          .select('*')
          .eq('client_id', currentClient.id)
          .or(`rule_id.eq.${selectedCorrelatedItem.rule_id},source_ip.eq.${selectedCorrelatedItem.latest_source_ip || 'NONE'}`)
          .order('timestamp', { ascending: false })
          .limit(30);
        setGroupAlerts(alerts || []);
      } catch (e) {
        console.error("Error fetching group alerts:", e);
      } finally {
        setGroupAlertsLoading(false);
      }
    };

    if (showCorrelatedPopup && selectedCorrelatedItem && correlatedPopupTab === 'groups') {
      fetchGroupAlerts();
    }
  }, [selectedCorrelatedItem, correlatedPopupTab, showCorrelatedPopup, currentClient]);

  const fetchEntityDrift = async (linkedAlert: any) => {
    if (!linkedAlert || !currentClient) return null;
    
    // Get all alerts for agent from last 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      const { data: allAgentAlerts } = await supabase
        .from('alerts')
        .select('severity, timestamp, rule_id, source_ip')
        .eq('client_id', currentClient.id)
        .ilike('agent_name', `%${linkedAlert.agent_name}%`)
        .gte('timestamp', sixtyDaysAgo)
        .order('timestamp', { ascending: true });

      if (!allAgentAlerts || allAgentAlerts.length < 5) return null;

      const baselineAlerts = allAgentAlerts.filter(a => new Date(a.timestamp) < new Date(sevenDaysAgo));
      const currentAlerts = allAgentAlerts.filter(a => new Date(a.timestamp) >= new Date(sevenDaysAgo));

      if (baselineAlerts.length === 0) return null;

      const baselineDailyAvg = baselineAlerts.length / 23;
      const currentDailyAvg = currentAlerts.length / 7;
      const volumeRatio = baselineDailyAvg > 0 ? currentDailyAvg / baselineDailyAvg : 0;

      const baselineRules = [...new Set(baselineAlerts.map(a => a.rule_id))];
      const currentRules = [...new Set(currentAlerts.map(a => a.rule_id))];
      const newRules = currentRules.filter(r => !baselineRules.includes(r));

      return {
        entity_name: linkedAlert.agent_name,
        volume_ratio: volumeRatio,
        baseline_daily: baselineDailyAvg.toFixed(1),
        current_daily: currentDailyAvg.toFixed(1),
        new_rules_count: newRules.length,
        new_rules: newRules.slice(0, 3),
        baseline_alert_count: baselineAlerts.length,
        current_alert_count: currentAlerts.length,
        drifting: volumeRatio > 2 || newRules.length > 0
      };
    } catch (e) {
      console.error("Error fetching entity drift:", e);
      return null;
    }
  };

  const generateIncidentStory = async () => {
    if (!data.linkedAlert) return;
    setStoryLoading(true);
    
    const timelineCount = (data.relatedAlerts || []).length;
    const hasThreatIntel = (data.threatIntel || []).length > 0;
    const keyFindings = (data.notes || []).filter((n: any) => n.is_key_finding).map((n: any) => n.note);
    
    const prompt = `You are a senior SOC analyst. Based on these facts, write a 3-4 sentence incident story in plain English that explains what likely happened. Write it like you are briefing a manager — no jargon, just clear facts.

Alert: ${data.linkedAlert.description}
Severity: ${data.linkedAlert.severity}
Agent: ${data.linkedAlert.agent_name}
Source IP: ${getSourceIp(data.linkedAlert)}
Time: ${data.linkedAlert.timestamp}
Related events in timeline: ${timelineCount}
Threat intel: ${hasThreatIntel && data.threatIntel[0] ? data.threatIntel[0].final_verdict + ' (score: ' + data.threatIntel[0].combined_score + '/100)' : 'Not checked'}
Key analyst findings: ${keyFindings.join('. ') || 'None yet'}
Entity drift: ${entityDrift?.drifting ? 'Yes — ' + entityDrift.current_daily + 'x normal volume' : 'No drift detected'}

Respond with ONLY a JSON object:
{
  "story": "The incident story in 3-4 plain English sentences",
  "likely_scenario": "One sentence — most likely explanation",
  "confidence": 60,
  "recommended_action": "One sentence — most important thing analyst should do next"
}`;

    try {
      const result = await generateAINarrative(prompt, 'You are a senior SOC analyst writing incident briefings.');
      setIncidentStory(result);
      
      // Persist the narrative
      if (workspace?.id) {
        await supabase.from('investigation_workspaces')
          .update({ ai_narrative: result })
          .eq('id', workspace.id);
      }
    } catch (e) {
      console.error("Incident Story Error:", e);
      setIncidentStory({
        story: 'Unable to generate story. Add investigation notes and run threat intel to improve context.',
        likely_scenario: 'Unknown',
        confidence: 0,
        recommended_action: 'Add more context to generate a story.'
      });
    } finally {
      setStoryLoading(false);
    }
  };

  useEffect(() => {
    if (data.linkedAlert && currentClient) {
      fetchEntityDrift(data.linkedAlert).then(res => setEntityDrift(res));
    }
  }, [data.linkedAlert, currentClient]);

  const handleAddDetailedAlertAsEvidence = async (alert: any) => {
    if (!currentClient || !workspace) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('investigation_evidence').insert({
      workspace_id: workspace.id,
      escalation_id: esc.id,
      client_id: currentClient.id,
      evidence_type: 'alert',
      title: `Detailed Alert: ${alert.description}`,
      description: `Analyst added detailed alert context for ${alert.alert_number || alert.id.slice(0,8)}`,
      data: alert,
      source: `Rule ${alert.rule_id}`,
      confidence: 'High',
      added_by: user.email
    });
    
    // Trigger parent refresh
    onAddAlertAsEvidence(alert);
  };

  const handleAlertClick = (alert: any) => {
    setSelectedAlertDetail(alert);
  };

  const handleCreateCase = async () => {
    if (!currentClient || !esc || !workspace) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: newCase, error } = await supabase.from('cases').insert({
      title: caseTitle,
      description: caseDescription,
      status: 'Investigating',
      severity: esc.severity,
      priority: casePriority,
      client_id: currentClient.id,
      alert_id: esc.alert_id,
      agent_name: esc.agent_name,
      source_ip: data.linkedAlert?.source_ip,
      rule_id: data.linkedAlert?.rule_id,
      escalated_by: user.email,
      escalated_at: new Date().toISOString(),
      sla_deadline: esc.sla_deadline
    }).select().single();

    if (newCase) {
      // Update workspace with linked case
      await supabase.from('investigation_workspaces')
        .update({ case_id: newCase.id })
        .eq('id', workspace.id);
      
      // Log to escalation activity
      await supabase.from('escalation_activity').insert({
        escalation_id: esc.id,
        action: 'Case Created',
        performed_by: user.email,
        details: `Case ${newCase.case_number} created from investigation workspace`
      });
      
      setCaseCreated(newCase);
      setShowCreateCasePopup(false);
      showSuccessToast(`Case ${newCase.case_number} created successfully`);
    } else if (error) {
      console.error("Case creation failed:", error);
    }
  };

  const handleAddDriftAsEvidence = async (drift: any) => {
    if (!currentClient || !workspace || !esc) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('investigation_evidence').insert({
      workspace_id: workspace.id,
      escalation_id: esc.id,
      client_id: currentClient.id,
      evidence_type: 'analyst_observation',
      title: `Behavioral Drift: ${drift.entity_name}`,
      description: `Entity showing ${drift.volume_ratio.toFixed(1)}x normal alert volume. ${drift.new_rules_count} new rules detected.`,
      data: drift,
      source: 'Entity Behavior Analysis',
      confidence: drift.volume_ratio > 3 ? 'High' : 'Medium',
      added_by: user.email
    });
    
    // Using onAddEvidence to signal refresh/update in parent
    onAddEvidence('analyst_observation', `Behavioral Drift: ${drift.entity_name}`, `Entity showing ${drift.volume_ratio.toFixed(1)}x normal alert volume.`, drift.volume_ratio > 3 ? 'High' : 'Medium');
    
    showSuccessToast('Behavioral drift added as evidence');
    setShowEntityBehaviorPopup(false);
  };

  const handleAddGroupAsEvidence = async (group: any) => {
    if (!currentClient || !workspace || !esc) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const alreadyAdded = (data.evidence || []).some((e: any) => e.title.includes(group.rule_description?.slice(0, 30)));
    if (alreadyAdded) { 
      showWarningToast('Already in evidence'); 
      return; 
    }
    
    await supabase.from('investigation_evidence').insert({
      workspace_id: workspace.id,
      escalation_id: esc.id,
      client_id: currentClient.id,
      evidence_type: 'alert',
      title: `Alert Group: ${group.rule_description}`,
      description: `${group.alert_count} correlated alerts. First: ${new Date(group.first_seen).toLocaleString()}. Last: ${new Date(group.last_seen).toLocaleString()}`,
      data: group,
      source: `Wazuh Rule ${group.rule_id}`,
      confidence: group.severity === 'Critical' || group.severity === 'High' ? 'High' : 'Medium',
      added_by: user.email
    });
    
    onAddAlertAsEvidence(group); // Using this to trigger refresh
    showSuccessToast('Alert group added to evidence');
  };

  const handleAddAlertAsEvidence = async (alert: any) => {
    if (!currentClient || !workspace || !esc) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const alreadyAdded = (data.evidence || []).some((e: any) => e.alert_id === alert.id);
    if (alreadyAdded) {
       showWarningToast('Alert already added as evidence');
       return;
    }

    await supabase.from('investigation_evidence').insert({
      workspace_id: workspace.id,
      escalation_id: esc.id,
      client_id: currentClient.id,
      evidence_type: 'alert',
      title: `Alert: ${alert.description}`,
      description: `Correlated alert found during investigation. Rule ID: ${alert.rule_id}`,
      data: alert,
      alert_id: alert.id,
      source: `Wazuh Alert ${alert.alert_number || alert.id.slice(0,8)}`,
      confidence: 'High',
      added_by: user.email
    });
    
    onAddAlertAsEvidence(alert);
    showSuccessToast('Alert added as evidence');
  };

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

  const checklistItems = workspace?.checklist_items || defaultItems;

  const completedCount = checklistItems.filter((item: any) => workspace?.checklist?.[item.id]).length;
  const progressPercent = checklistItems.length > 0 ? (completedCount / checklistItems.length) * 100 : 0;

  const rawLog = typeof data.linkedAlert?.raw_log === 'string' 
    ? JSON.parse(data.linkedAlert.raw_log) 
    : data.linkedAlert?.raw_log;

  const mitre = rawLog?.rule?.mitre || {};
  const mitreIds = mitre.id || [];
  const mitreTactics = mitre.tactic || [];

  const timelineAlerts = (data.relatedAlerts || []).filter((a: any) => 
    a.rule_id === data.linkedAlert?.rule_id ||
    (a.source_ip && a.source_ip === data.linkedAlert?.source_ip)
  ).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const involvedAgents = [...new Set(timelineAlerts.map((a: any) => a.agent_name).filter(Boolean))];

  const threatIntel = (data.threatIntel || []).find((t: any) => t.ip === data.linkedAlert?.source_ip);

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
      {/* False Positive Banner */}
      {data.similarCases?.some((c: any) => c.verdict === 'False Positive') && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 py-2 px-6 flex items-center justify-center gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-500">
            ADVISORY: Similar incidents were previously resolved as FALSE POSITIVE for Rule {data.linkedAlert?.rule_id}
          </p>
        </div>
      )}

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
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">LIVE — {workspace.opened_by} INVESTIGATING</span>
                </div>
                {caseCreated && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Briefcase className="w-3 h-3 text-blue-400" />
                    <span className="text-[9px] font-bold text-blue-400">{caseCreated.case_number}</span>
                  </div>
                )}
              </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onAddCurrentFindingsAsEvidence}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group"
          >
             <Target className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
             Capture Evidence
          </button>
          <button
            onClick={() => setShowCreateCasePopup(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            <Briefcase className="w-4 h-4" />
            Create Case
          </button>
          <button 
            onClick={onGenerateReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 border border-purple-500/10 hover:border-purple-500/20 rounded-xl transition-all group"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Generate Report</span>
          </button>
          <button 
            onClick={onShowVerdict}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 hover:border-emerald-500/20 rounded-xl transition-all group"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Set Verdict</span>
          </button>
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all border border-neutral-700 hover:border-neutral-600"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Save & Close</span>
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
                          <span className={cn(
                            "font-mono", 
                            getSourceIp(data.linkedAlert) === 'N/A' ? 'text-neutral-600' : 'text-blue-400'
                          )}>
                            {getSourceIp(data.linkedAlert)}
                          </span>
                          {getSourceIp(data.linkedAlert) !== 'N/A' && (
                            <button onClick={() => navigator.clipboard.writeText(getSourceIp(data.linkedAlert))} className="p-1 hover:bg-white/10 rounded transition-colors">
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

              {/* Enhancement 1: Entity Behavior panel */}
              {entityDrift && (
                <div 
                  onClick={() => setShowEntityBehaviorPopup(true)}
                  className={cn(
                    "p-5 border rounded-2xl transition-all shadow-sm cursor-pointer group/behavior",
                    entityDrift.drifting 
                      ? 'border-yellow-500/30 bg-yellow-500/[0.03] shadow-yellow-500/5 hover:bg-yellow-500/[0.06] hover:border-yellow-500/50' 
                      : 'border-neutral-800 bg-neutral-900/20 hover:bg-neutral-800/40 hover:border-neutral-700'
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <Activity className={cn(
                        "w-4 h-4 transition-transform group-hover/behavior:scale-110",
                        entityDrift.drifting ? "text-yellow-400" : "text-blue-400"
                      )} />
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Entity Behavior</span>
                    </div>
                    {entityDrift.drifting ? (
                      <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded uppercase border border-yellow-500/20 shadow-sm animate-pulse">
                        DRIFT DETECTED
                      </span>
                    ) : (
                      <ChevronRight className="w-3 h-3 text-neutral-600 group-hover/behavior:text-neutral-400 transition-all group-hover/behavior:translate-x-0.5" />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black/40 border border-neutral-800/50 rounded-xl">
                      <p className="text-[8px] text-neutral-600 font-bold uppercase mb-1 tracking-widest">Baseline (30d avg)</p>
                      <p className="text-xl font-black text-white tracking-tighter">{entityDrift.baseline_daily}</p>
                    </div>
                    <div className={cn(
                      "p-3 border rounded-xl",
                      entityDrift.volume_ratio > 2 ? 'bg-red-500/5 border-red-500/10' : 'bg-black/40 border-neutral-800/50'
                    )}>
                      <p className="text-[8px] text-neutral-600 font-bold uppercase mb-1 tracking-widest">Current (7d avg)</p>
                      <div className="flex items-baseline gap-1.5 overflow-hidden">
                        <p className={cn(
                          "text-xl font-black tracking-tighter",
                          entityDrift.volume_ratio > 2 ? 'text-red-500' : 'text-neutral-300'
                        )}>
                          {entityDrift.current_daily}
                        </p>
                        {entityDrift.volume_ratio > 2 && (
                          <span className="text-[10px] font-black text-red-500/80">
                            ↑{entityDrift.volume_ratio.toFixed(1)}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {entityDrift.new_rules_count > 0 && (
                    <div className="mt-4 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-orange-400 mt-0.5" />
                        <p className="text-[11px] text-neutral-400 leading-tight">
                          <span className="text-orange-400 font-bold">{entityDrift.new_rules_count} new rule(s)</span> firing that were not seen before.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* INCIDENT TIMELINE PANEL */}
            <div className="border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-900/20">
              
              {/* Collapsible header */}
              <button
                onClick={() => setTimelineExpanded(!timelineExpanded)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors group/timeline"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                    <GitBranch className="w-4 h-4 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Incident Timeline</p>
                    <p className="text-[9px] text-neutral-500 mt-0.5 font-bold uppercase tracking-widest">
                      {timelineLoading ? 'Syncing Chain...' : `${incidentTimeline.length} events in ±2 hour window`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {incidentTimeline.length > 0 && !timelineLoading && (
                    <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-widest">
                      {incidentTimeline.length} EVENTS
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-500 ${timelineExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Timeline content */}
              <AnimatePresence>
                {timelineExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5">
                      {timelineLoading ? (
                        // Loading skeleton
                        <div className="space-y-4 py-4">
                          {[1,2,3].map(i => (
                            <div key={i} className="flex gap-4 animate-pulse">
                              <div className="w-2 h-2 rounded-full bg-neutral-800 mt-1.5 shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-3 bg-neutral-800 rounded-lg w-3/4" />
                                <div className="h-2 bg-neutral-800 rounded-lg w-1/2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : incidentTimeline.length > 0 ? (
                        <div className="relative py-2">
                          {/* Timeline summary header (interactive filters) */}
                          <div className="mb-6 pb-4 border-b border-neutral-800/50 grid grid-cols-3 gap-2">
                            <button 
                              onClick={() => setTimelineFilter(timelineFilter === 'pre' ? 'all' : 'pre')}
                              className={`text-center p-2 rounded-xl transition-all ${timelineFilter === 'pre' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}
                            >
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${timelineFilter === 'pre' ? 'text-white' : 'text-neutral-600'}`}>Pre-Event</p>
                              <p className={`text-sm font-black ${timelineFilter === 'pre' ? 'text-white' : 'text-neutral-400'}`}>
                                {incidentTimeline.filter(a => new Date(a.timestamp) < new Date(data.linkedAlert?.timestamp) && a.id !== data.linkedAlert?.id).length}
                              </p>
                            </button>
                            <button 
                              onClick={() => setTimelineFilter(timelineFilter === 'trigger' ? 'all' : 'trigger')}
                              className={`text-center border-x border-neutral-800/50 p-2 rounded-xl transition-all ${timelineFilter === 'trigger' ? 'bg-red-500/10 border-red-500/20' : 'hover:bg-white/5'}`}
                            >
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${timelineFilter === 'trigger' ? 'text-red-400' : 'text-red-500'}`}>Trigger</p>
                              <p className={`text-sm font-black ${timelineFilter === 'trigger' ? 'text-red-400' : 'text-red-400'}`}>1</p>
                            </button>
                            <button 
                              onClick={() => setTimelineFilter(timelineFilter === 'post' ? 'all' : 'post')}
                              className={`text-center p-2 rounded-xl transition-all ${timelineFilter === 'post' ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}
                            >
                              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${timelineFilter === 'post' ? 'text-white' : 'text-neutral-600'}`}>Post-Event</p>
                              <p className={`text-sm font-black ${timelineFilter === 'post' ? 'text-white' : 'text-neutral-400'}`}>
                                {incidentTimeline.filter(a => new Date(a.timestamp) > new Date(data.linkedAlert?.timestamp)).length}
                              </p>
                            </button>
                          </div>

                          {/* Vertical line with gradient - adjusted top to start after filters */}
                          <div className="absolute left-[8px] top-[140px] bottom-4 w-[2px] bg-gradient-to-b from-orange-500/20 via-neutral-800 to-transparent" />
                          
                          <div className="space-y-2">
                            {incidentTimeline
                              .filter(alert => {
                                if (timelineFilter === 'all') return true;
                                const isTrigger = alert.id === data.linkedAlert?.id;
                                const isBefore = new Date(alert.timestamp) < new Date(data.linkedAlert?.timestamp);
                                const isAfter = new Date(alert.timestamp) > new Date(data.linkedAlert?.timestamp);
                                
                                if (timelineFilter === 'trigger') return isTrigger;
                                if (timelineFilter === 'pre') return isBefore && !isTrigger;
                                if (timelineFilter === 'post') return isAfter && !isTrigger;
                                return true;
                              })
                              .map((alert, idx) => {
                                const isTrigger = alert.id === data.linkedAlert?.id;
                                const isBeforeTrigger = new Date(alert.timestamp) < new Date(data.linkedAlert?.timestamp);
                                
                                return (
                                  <div
                                    key={alert.id}
                                    onClick={() => {
                                      setSelectedTimelineAlert(alert);
                                      setShowTimelineAlertPopup(true);
                                    }}
                                    className={`relative flex gap-4 pl-6 py-3 rounded-2xl cursor-pointer transition-all duration-300 group
                                      ${isTrigger 
                                        ? 'bg-red-500/10 border border-red-500/30 shadow-lg shadow-red-500/5' 
                                        : 'hover:bg-white/[0.03] border border-transparent hover:border-neutral-800'
                                      }`}
                                  >
                                    {/* Timeline dot */}
                                    <div className={`absolute left-[4px] top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-2 border-neutral-900 z-10 transition-all duration-500
                                      ${isTrigger ? 'bg-red-500 w-4 h-4 left-[1px] shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' :
                                        alert.severity === 'Critical' ? 'bg-red-500' :
                                        alert.severity === 'High' ? 'bg-orange-500' :
                                        alert.severity === 'Medium' ? 'bg-blue-500' :
                                        'bg-neutral-600'
                                      }`}
                                    />

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono font-bold text-neutral-500 shrink-0">
                                          {new Date(alert.timestamp).toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: false
                                          })}
                                        </span>
                                        <SeverityBadge severity={alert.severity} />
                                        {isTrigger && (
                                          <span className="text-[8px] font-black text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded-full uppercase tracking-widest bg-black">
                                            TRIGGER
                                          </span>
                                        )}
                                        {isBeforeTrigger && !isTrigger && (
                                          <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest font-mono">T-minus</span>
                                        )}
                                      </div>
                                      
                                      <p className={`text-[12px] leading-tight font-bold mb-1.5 truncate transition-colors
                                        ${isTrigger ? 'text-red-300' : 'text-neutral-400 group-hover:text-white'}`}
                                      >
                                        {alert.description}
                                      </p>
                                      
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-neutral-600 uppercase">{alert.agent_name}</span>
                                        {alert.source_ip && alert.source_ip !== 'N/A' && (
                                          <>
                                            <div className="w-1 h-1 rounded-full bg-neutral-800" />
                                            <span className="text-[9px] text-neutral-500 font-mono">{alert.source_ip}</span>
                                          </>
                                        )}
                                        <div className="w-1 h-1 rounded-full bg-neutral-800" />
                                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-tighter">Rule {alert.rule_id}</span>
                                      </div>
                                    </div>

                                    {/* Add evidence button - shows on hover */}
                                    <button
                                      onClick={e => { e.stopPropagation(); onAddAlertAsEvidence(alert); }}
                                      className="shrink-0 opacity-0 group-hover:opacity-100 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all self-center text-neutral-400 hover:text-white"
                                      title="Add as evidence"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-10 border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/40 mt-4">
                          <Clock className="w-8 h-8 text-neutral-700 mx-auto mb-3 opacity-50" />
                          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Temporal Isolation</p>
                          <p className="text-[9px] text-neutral-700 mt-2 uppercase tracking-tight max-w-[200px] mx-auto leading-relaxed">
                            No related events discovered within the 4-hour forensic window
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Enhancement 2: Incident Story panel */}
            <div className="p-5 border border-purple-500/20 bg-purple-500/[0.03] rounded-2xl space-y-4 shadow-xl shadow-purple-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Incident Story</span>
                </div>
                <button
                  onClick={generateIncidentStory}
                  disabled={storyLoading}
                  className="text-[9px] font-black text-purple-400 hover:text-white px-3 py-1 bg-purple-500/10 rounded-lg uppercase tracking-widest transition-all border border-purple-500/20 hover:bg-purple-500"
                >
                  {storyLoading ? (
                    <div className="flex items-center gap-2">
                       <RefreshCw className="w-3 h-3 animate-spin" />
                       <span>Analyzing...</span>
                    </div>
                  ) : incidentStory ? 'Regenerate Briefing' : 'Generate Narrative'}
                </button>
              </div>
              
              {incidentStory ? (
                <div className="space-y-4">
                  <p className="text-[13px] text-neutral-300 leading-relaxed font-medium">
                    "{incidentStory.story}"
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 bg-black/40 border border-neutral-800 rounded-xl relative group">
                      <p className="text-[8px] font-black text-neutral-600 uppercase mb-1.5 tracking-widest">Most Likely Scenario</p>
                      <div className="flex items-start gap-3">
                         <div className="w-1 h-3 rounded-full bg-purple-500 mt-1" />
                         <p className="text-[11px] text-neutral-300 font-bold leading-tight">{incidentStory.likely_scenario}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl relative">
                      <p className="text-[8px] font-black text-neutral-600 uppercase mb-1.5 tracking-widest">Recommended Next Step</p>
                      <div className="flex items-start gap-3">
                         <div className="w-1 h-3 rounded-full bg-blue-500 mt-1" />
                         <p className="text-[11px] text-blue-400 font-bold leading-tight">{incidentStory.recommended_action}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-black/40 p-3 rounded-xl border border-neutral-800">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-neutral-600">
                         <span>Confidence Rating</span>
                         <span className="text-purple-400">{incidentStory.confidence}%</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                           className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]" 
                           initial={{ width: 0 }}
                           animate={{ width: incidentStory.confidence + '%' }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-purple-500/5 flex items-center justify-center border border-purple-500/10">
                      <TrendingUp className="w-5 h-5 text-purple-500/30" />
                   </div>
                   <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest max-w-[200px]">
                      Sync investigation data and click generate for a plain English executive briefing
                   </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Agent Profile & IOC Evidence */}
        <div className="w-1/3 border-r border-neutral-800 flex flex-col overflow-hidden bg-neutral-900/20">
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* IOC Investigation Sandbox */}
            <div className="p-5 bg-neutral-900/30 border border-neutral-800 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Radar className="w-4 h-4 text-blue-400" />
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">IOC Investigation Sandbox</h4>
              </div>
              
              <div className="relative">
                <input 
                  type="text" 
                  value={iocInput}
                  onChange={(e) => setIocInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIOCSearch()}
                  placeholder="Enter IP, Domain, or File Hash..."
                  className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-3 text-[11px] font-mono text-white placeholder:text-neutral-700 focus:border-blue-500/50 outline-none transition-all pr-12"
                />
                <button 
                  onClick={handleIOCSearch}
                  disabled={iocSearchLoading || !iocInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {iocSearchLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>

              <AnimatePresence>
                {iocSearchResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-black/40 border border-neutral-800 rounded-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className={cn(
                           "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                           iocSearchResult.reputation === 'Malicious' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                           iocSearchResult.reputation === 'Suspicious' ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                           "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                         )}>
                           {iocSearchResult.reputation}
                         </div>
                         <span className="text-[10px] font-bold text-neutral-500 uppercase">{iocSearchResult.provider}</span>
                      </div>
                      <button 
                        onClick={addIOCAsEvidence}
                        className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Evidence
                      </button>
                    </div>
                    
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                      {iocSearchResult.details}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Universal Alert Investigator */}
            <div className="p-5 bg-blue-500/[0.03] border border-blue-500/10 rounded-2xl space-y-4 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1">
                <div className="w-16 h-16 bg-blue-500/5 blur-2xl rounded-full" />
              </div>
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-400" />
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Universal Alert Investigator</h4>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Cross-Org Search</span>
                </div>
              </div>
              
              <div 
                onClick={() => {
                  setShowGlobalSearch(true);
                  if (globalSearchResults.length === 0) handleGlobalAlertSearch();
                }}
                className="relative group cursor-pointer"
              >
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-neutral-600 group-hover:text-blue-400 transition-colors" />
                </div>
                <div className="w-full bg-black/60 border border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-[11px] text-neutral-500 flex items-center justify-between group-hover:border-blue-500/50 transition-all">
                  <span>Search across all organization alerts...</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-[9px] font-mono border border-neutral-700">CTRL</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-[9px] font-mono border border-neutral-700">F</kbd>
                  </div>
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
                          <span className="text-xl font-bold text-white">{(data.agentAlerts || []).length}</span>
                       </div>
                       <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                          <span className="text-[9px] font-bold text-neutral-600 uppercase block mb-1">Critical/High</span>
                          <span className="text-xl font-bold text-red-500">
                             {(data.agentAlerts || []).filter((a: any) => a.severity === 'Critical' || a.severity === 'High').length}
                          </span>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block">Last Activity</span>
                       <div className="p-3 bg-black flex items-center gap-3 rounded-lg border border-neutral-800">
                          <Clock className="w-3.5 h-3.5 text-neutral-600" />
                          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                             Last keepalive <span title={new Date(data.agentProfile.last_keepalive).toLocaleString()}>{formatRelativeTime(data.agentProfile.last_keepalive)}</span>
                           </span>
                       </div>
                    </div>
                 </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-neutral-800 rounded-2xl">
                   <Database className="w-8 h-8 text-neutral-800" />
                   <p className="text-[11px] text-neutral-600 uppercase font-bold tracking-widest">Agent metadata unavailable</p>
                </div>
              )}

              {/* Similar Past Cases Panel */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Clipboard className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Similar Past Cases</h4>
                </div>

                <div className="space-y-3">
                   {data.similarCases?.length > 0 ? (
                      data.similarCases.map((caseItem: any, i: number) => (
                         <div key={i} className="p-4 bg-black/40 border border-neutral-800 rounded-2xl hover:border-neutral-700 transition-all group relative overflow-hidden">
                            {caseItem.verdict === 'False Positive' && (
                               <div className="absolute top-0 right-0 px-2 py-0.5 bg-yellow-500 text-black text-[7px] font-black uppercase tracking-widest">FP HISTORY</div>
                            )}
                            <div className="flex items-center justify-between mb-2">
                               <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">{caseItem.case_number}</span>
                               <span className={cn(
                                  "text-[8px] font-bold px-1.5 py-0.5 rounded",
                                  caseItem.status === 'Resolved' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                               )}>{caseItem.status}</span>
                            </div>
                            <h6 className="text-[11px] font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{caseItem.title}</h6>
                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-neutral-800/50">
                               <div className="flex flex-col">
                                  <span className="text-[7px] font-bold text-neutral-700 uppercase">Verdict</span>
                                  <span className="text-[9px] font-bold text-neutral-400">{caseItem.verdict || 'None'}</span>
                               </div>
                               <span className="text-[8px] text-neutral-600 font-mono">{new Date(caseItem.created_at).toLocaleDateString()}</span>
                            </div>
                         </div>
                      ))
                   ) : (
                      <div className="py-8 border border-dashed border-neutral-800 rounded-2xl flex items-center justify-center">
                         <span className="text-[9px] text-neutral-700 font-bold uppercase tracking-widest">No similar cases found</span>
                      </div>
                   )}
                </div>
              </div>

              {/* Last 5 Alerts list */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Recent Activity on Agent</h5>
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                   {(data.agentAlerts || []).slice(0, 5).map((alert: any, i: number) => (
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
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAddingCheckItem(!isAddingCheckItem)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/10"
                    title="Add Task"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest leading-none bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                    {completedCount} / {checklistItems.length} Done
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-neutral-900/40 border border-neutral-800 p-4 rounded-2xl">
                 <div className="h-1.5 bg-neutral-800/50 rounded-full overflow-hidden mb-1">
                    <motion.div 
                      className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                    />
                 </div>
                 
                 <AnimatePresence>
                   {isAddingCheckItem && (
                     <motion.div 
                       initial={{ opacity: 0, y: -4 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -4 }}
                       className="flex items-center gap-2 mb-4"
                     >
                       <input 
                         autoFocus
                         type="text"
                         value={newCheckItemLabel}
                         onChange={(e) => setNewCheckItemLabel(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && newCheckItemLabel.trim()) {
                             onAddChecklistItem(newCheckItemLabel.trim());
                             setNewCheckItemLabel('');
                             setIsAddingCheckItem(false);
                           }
                           if (e.key === 'Escape') setIsAddingCheckItem(false);
                         }}
                         placeholder="Add custom task..."
                         className="flex-1 bg-black border border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-white focus:border-emerald-500/50 outline-none placeholder:text-neutral-700"
                       />
                       <button 
                         onClick={() => {
                           if (newCheckItemLabel.trim()) {
                             onAddChecklistItem(newCheckItemLabel.trim());
                             setNewCheckItemLabel('');
                             setIsAddingCheckItem(false);
                           }
                         }}
                         className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 border border-emerald-500/10"
                       >
                         <Check className="w-3.5 h-3.5" />
                       </button>
                     </motion.div>
                   )}
                 </AnimatePresence>

                 <div className="space-y-1">
                    {checklistItems.map((item: any) => (
                       <div key={item.id} className="flex items-center justify-between group p-1">
                          <label className="flex items-center gap-3 py-1 flex-1 cursor-pointer overflow-hidden">
                             <div 
                               onClick={() => onChecklistUpdate(item.id, !workspace.checklist?.[item.id])}
                               className={cn(
                                 "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                 workspace.checklist?.[item.id] ? "bg-emerald-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "bg-black border-neutral-700 group-hover:border-neutral-500"
                               )}
                             >
                                {workspace.checklist?.[item.id] && <Check className="w-2.5 h-2.5 text-white" />}
                             </div>
                             <span className={cn(
                               "text-[11px] font-medium transition-all duration-300 truncate pr-2",
                               workspace.checklist?.[item.id] ? "text-neutral-500 line-through" : "text-neutral-300 group-hover:text-white"
                             )}>
                                {item.label}
                             </span>
                          </label>
                          <button 
                            onClick={() => onRemoveChecklistItem(item.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                       </div>
                    ))}
                    {checklistItems.length === 0 && (
                      <div className="py-4 text-center">
                        <span className="text-[10px] text-neutral-600 uppercase font-black tracking-widest italic">No tasks active</span>
                      </div>
                    )}
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
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Evidence Locker ({(data.evidence || []).length})</h4>
                </div>
                <button 
                  onClick={() => setShowEvidenceModal(true)}
                  className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                 {(data.evidence || []).map((ev: any, i: number) => (
                    <div key={i} className="p-4 border border-neutral-800 rounded-xl bg-black/40 hover:bg-black/60 transition-all group">
                       <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                             <span className={cn(
                                "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border shadow-sm w-fit",
                                ev.evidence_type === 'alert' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                ev.evidence_type === 'threat_intel' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                ev.evidence_type === 'analyst_note' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                'bg-neutral-800 text-neutral-400 border-neutral-700'
                             )}>{ev.evidence_type}</span>
                             {ev.evidence_type === 'alert' && ev.data && (
                                <div className="flex items-center gap-2">
                                   <SeverityBadge severity={ev.data.severity} />
                                   <span className="text-[8px] font-bold text-neutral-500 uppercase">Rule {ev.data.rule_id}</span>
                                </div>
                             )}
                          </div>
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
                       
                       {ev.evidence_type === 'alert' && ev.data && (
                          <div className="mb-4 grid grid-cols-2 gap-2 p-2 bg-neutral-900/50 rounded-lg border border-neutral-800/50">
                             <div className="flex flex-col">
                                <span className="text-[7px] font-bold text-neutral-700 uppercase">Alert ID</span>
                                <span className="text-[9px] font-mono text-neutral-400 truncate">{ev.data.alert_number || ev.data.id.slice(0,8)}</span>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[7px] font-bold text-neutral-700 uppercase">MITRE ATT&CK</span>
                                <span className="text-[9px] font-mono text-neutral-400 truncate">
                                   {(() => {
                                     try {
                                       const log = typeof ev.data.raw_log === 'string' ? JSON.parse(ev.data.raw_log) : ev.data.raw_log;
                                       return (log?.rule?.mitre?.id || []).join(', ') || 'N/A';
                                     } catch(e) { return 'N/A'; }
                                   })()}
                                </span>
                             </div>
                          </div>
                       )}

                       <div className="flex items-center justify-between pt-2 border-t border-neutral-800/50">
                          <span className="text-[8px] font-bold text-neutral-700 uppercase">{ev.added_by}</span>
                          <span className="text-[8px] text-neutral-800 font-mono">{new Date(ev.created_at).toLocaleDateString()}</span>
                       </div>
                    </div>
                 ))}
                 {(data.evidence || []).length === 0 && (
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
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Investigation Notes ({(data.notes || []).length})</h4>
              </div>

              <div className="space-y-4">
                 <div className="space-y-3">
                    {(data.notes || []).map((note: any) => (
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
                         className="px-6 py-2.5 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 border border-blue-500/10 hover:border-blue-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group active:scale-95"
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

      {/* Alert Detail Side Panel (Fix 4) */}
      <AnimatePresence>
         {selectedAlertDetail && (
            <>
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={() => setSelectedAlertDetail(null)}
                 className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm"
               />
               <motion.div 
                 initial={{ x: '100%' }}
                 animate={{ x: 0 }}
                 exit={{ x: '100%' }}
                 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                 className="fixed top-0 right-0 bottom-0 w-[450px] z-[260] bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl"
               >
                  <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/40">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                           <AlertCircle className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                           <h3 className="text-sm font-black text-white uppercase tracking-widest">Alert Detail</h3>
                           <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{selectedAlertDetail.alert_number || selectedAlertDetail.id}</p>
                        </div>
                     </div>
                     <button onClick={() => setSelectedAlertDetail(null)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                        <ArrowLeftCircle className="w-6 h-6 text-neutral-500 hover:text-white" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Summary</h4>
                           <SeverityBadge severity={selectedAlertDetail.severity} />
                        </div>
                        <p className="text-sm font-bold text-white leading-relaxed">{selectedAlertDetail.description}</p>
                        
                        <div className="grid grid-cols-1 gap-1 border border-neutral-800 rounded-2xl overflow-hidden mt-6">
                           {[
                              { label: 'Timestamp', value: new Date(selectedAlertDetail.timestamp).toLocaleString() },
                              { label: 'Agent', value: selectedAlertDetail.agent_name },
                              { label: 'Source IP', value: getSourceIp(selectedAlertDetail) },
                              { label: 'Rule ID', value: selectedAlertDetail.rule_id },
                              { label: 'Status', value: selectedAlertDetail.status || 'Active' },
                           ].map((row, i) => (
                              <div key={i} className="grid grid-cols-3 bg-neutral-900/40 p-3.5 items-center border-b border-neutral-800 last:border-0">
                                 <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{row.label}</span>
                                 <span className="col-span-2 text-[11px] font-bold text-neutral-300 tracking-tight font-mono">{row.value}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">MITRE ATT&CK</h4>
                        <div className="flex flex-wrap gap-2">
                           {(() => {
                              const raw = typeof selectedAlertDetail.raw_log === 'string' ? JSON.parse(selectedAlertDetail.raw_log) : selectedAlertDetail.raw_log;
                              const mIds = raw?.rule?.mitre?.id || [];
                              const mTactics = raw?.rule?.mitre?.tactic || [];
                              
                              if (mIds.length === 0) return <span className="text-[10px] text-neutral-600 italic">No MITRE data available</span>;
                              
                              return mIds.map((id: string, i: number) => (
                                 <div key={i} className="px-3 py-1.5 bg-purple-500/5 border border-purple-500/10 rounded-lg flex flex-col">
                                    <span className="text-[10px] font-black text-purple-400 tracking-widest">{id}</span>
                                    <span className="text-[8px] text-neutral-500 uppercase font-bold">{mTactics[i] || 'Unknown Tactic'}</span>
                                 </div>
                              ));
                           })()}
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Raw Event Log</h4>
                           <button onClick={() => navigator.clipboard.writeText(typeof selectedAlertDetail.raw_log === 'string' ? selectedAlertDetail.raw_log : JSON.stringify(selectedAlertDetail.raw_log))} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                              <Copy className="w-3.5 h-3.5 text-neutral-500" />
                           </button>
                        </div>
                         <div className="bg-neutral-950 border border-neutral-900 rounded-2xl p-0.5 font-mono text-[10px] text-neutral-400 overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-hide">
                            <ParsedLogTable data={selectedAlertDetail.raw_log} />
                         </div>
                     </div>
                  </div>

                  <div className="p-6 bg-neutral-900/60 border-t border-neutral-800 flex flex-col gap-3">
                     <button 
                        onClick={() => handleAddDetailedAlertAsEvidence(selectedAlertDetail)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3"
                     >
                        <Anchor className="w-5 h-5" />
                        Add to Evidence Locker
                     </button>
                  </div>
               </motion.div>
            </>
         )}
      </AnimatePresence>

      {/* Create Case Popup */}
      <AnimatePresence>
        {showCreateCasePopup && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl scrollbar-hide"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Create Investigation Case</h3>
                    <p className="text-[11px] text-neutral-500">Linked to escalation {esc?.escalation_id}</p>
                  </div>
                </div>
                <button onClick={() => setShowCreateCasePopup(false)}>
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Case Title</label>
                  <input
                    value={caseTitle}
                    onChange={e => setCaseTitle(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Priority</label>
                  <select
                    value={casePriority}
                    onChange={e => setCasePriority(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    <option>P1 - Critical</option>
                    <option>P2 - High</option>
                    <option>P3 - Medium</option>
                    <option>P4 - Low</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Description</label>
                  <textarea
                    value={caseDescription}
                    onChange={e => setCaseDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Will be linked to case:</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {(data.evidence || []).length} evidence items · {(data.notes || []).length} investigation notes · {(data.threatIntel || []).length > 0 ? 'Threat intel results' : 'No threat intel'}
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-800 flex gap-3">
                <button onClick={() => setShowCreateCasePopup(false)} className="flex-1 py-3 rounded-xl text-xs font-bold text-neutral-500 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={handleCreateCase} className="flex-1 py-3 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all">
                  Create Case
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entity Behavior Centered Popup moved to bottom */}

      {/* Correlated Incidents Centered Popup */}
      <AnimatePresence>
        {showCorrelatedPopup && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="w-[1200px] h-[85vh] bg-black border border-white/10 flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.01]">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Correlated Incidents</h3>
                  </div>

                  <div className="flex bg-white/[0.02] border border-white/5 rounded-2xl p-1">
                    <button
                      onClick={() => setCorrelatedPopupTab('groups')}
                      className={`px-6 py-2 rounded-[0.9rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                        correlatedPopupTab === 'groups' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Alert Groups ({data.correlatedData?.groups?.length || 0})
                    </button>
                    <button
                      onClick={() => setCorrelatedPopupTab('alerts')}
                      className={`px-6 py-2 rounded-[0.9rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                        correlatedPopupTab === 'alerts' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Related Alerts ({data.correlatedData?.alerts?.length || 0})
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowCorrelatedPopup(false)} className="p-4 hover:bg-white/[0.03] rounded-2xl transition-all">
                  <X className="w-6 h-6 text-neutral-500 hover:text-white" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {/* Left: list of alerts/groups */}
                <div className="w-[420px] border-r border-white/5 overflow-y-auto p-8 space-y-4 scrollbar-hide bg-white/[0.01]">
                  {correlatedPopupTab === 'groups' && data.correlatedData?.groups?.map((group: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => setSelectedCorrelatedItem(group)}
                      className={cn(
                        "p-5 border rounded-3xl cursor-pointer transition-all duration-300 relative group overflow-hidden",
                        selectedCorrelatedItem?.rule_id === group.rule_id 
                          ? 'border-white/30 bg-white/[0.08] shadow-[0_0_30px_rgba(255,255,255,0.05)]' 
                          : 'border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                           <SeverityBadge severity={group.max_severity || group.severity} />
                           {(group.max_severity === 'High' || group.max_severity === 'Critical') ? (
                              <span className="px-2 py-0.5 bg-red-950/40 border border-red-500/50 rounded-full text-[8px] font-black tracking-widest text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] uppercase">Alert</span>
                           ) : (
                              <span className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-500/50 rounded-full text-[8px] font-black tracking-widest text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)] uppercase">Low</span>
                           )}
                        </div>
                        <span className="text-[9px] font-bold text-neutral-500 bg-white/5 px-2 py-1 rounded-lg">
                          {group.alert_count} EVENTS
                        </span>
                      </div>
                      <p className="text-[13px] font-bold text-neutral-200 leading-snug group-hover:text-white transition-colors">{group.rule_description}</p>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-neutral-600" />
                          <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{formatRelativeTime(group.last_seen)}</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleAddGroupAsEvidence(group) }}
                          className="text-[9px] font-bold text-neutral-500 hover:text-white uppercase tracking-widest"
                        >
                          + Evidence
                        </button>
                      </div>
                    </div>
                  ))}

                  {correlatedPopupTab === 'alerts' && data.correlatedData?.alerts?.map((alert: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => setSelectedCorrelatedItem(alert)}
                      className={cn(
                        "p-5 border rounded-3xl cursor-pointer transition-all duration-300 group",
                        selectedCorrelatedItem?.id === alert.id 
                          ? 'border-white/30 bg-white/[0.08] shadow-[0_0_30px_rgba(255,255,255,0.05)]' 
                          : 'border-white/5 hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <SeverityBadge severity={alert.severity} />
                        {(alert.severity === 'High' || alert.severity === 'Critical') ? (
                           <span className="px-2 py-0.5 bg-red-950/40 border border-red-500/50 rounded-full text-[8px] font-black tracking-widest text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] uppercase">Alert</span>
                        ) : (
                           <span className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-500/50 rounded-full text-[8px] font-black tracking-widest text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)] uppercase">Low</span>
                        )}
                        <span className="text-[10px] font-medium text-neutral-600 font-mono uppercase tracking-tighter">{alert.alert_number || alert.id?.slice(0,10)}</span>
                      </div>
                      <p className="text-[13px] font-bold text-neutral-200 leading-snug group-hover:text-white transition-colors line-clamp-2">{alert.description}</p>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{alert.agent_name}</span>
                        <div className="flex items-center gap-4">
                           <span className="text-[9px] font-medium text-neutral-600 uppercase tracking-widest">{formatRelativeTime(alert.timestamp)}</span>
                           <button
                             onClick={e => { e.stopPropagation(); handleAddAlertAsEvidence(alert) }}
                             className="text-[9px] font-bold text-neutral-500 hover:text-white uppercase tracking-widest"
                           >
                             + Evidence
                           </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: detail view of selected item */}
                <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                  {selectedCorrelatedItem ? (
                    <motion.div 
                      key={selectedCorrelatedItem.id || selectedCorrelatedItem.rule_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-12 max-w-5xl mx-auto"
                    >
                      {/* Item header */}
                      <div className="flex items-start justify-between gap-12">
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <SeverityBadge severity={selectedCorrelatedItem.max_severity || selectedCorrelatedItem.severity} />
                            {correlatedPopupTab === 'groups' ? (
                               <span className="px-3 py-1 bg-blue-950/40 border border-blue-500/50 rounded-full text-[10px] font-black tracking-widest text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)] uppercase">Activity Cluster</span>
                            ) : (selectedCorrelatedItem.severity === 'High' || selectedCorrelatedItem.severity === 'Critical') ? (
                               <span className="px-3 py-1 bg-red-950/40 border border-red-500/50 rounded-full text-[10px] font-black tracking-widest text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] uppercase">Threat Alert</span>
                            ) : (
                               <span className="px-3 py-1 bg-emerald-950/40 border border-emerald-500/50 rounded-full text-[10px] font-black tracking-widest text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)] uppercase">Low Risk</span>
                            )}
                            {selectedCorrelatedItem.alert_count && (
                              <span className="text-xs font-mono text-neutral-500 font-medium px-3 py-1 bg-white/[0.03] border border-white/10 rounded-lg">{selectedCorrelatedItem.alert_count} AGGREGATED EVENTS</span>
                            )}
                          </div>
                          <h4 className="text-4xl font-bold text-white tracking-tighter leading-tight">
                            {selectedCorrelatedItem.rule_description || selectedCorrelatedItem.description}
                          </h4>
                        </div>
                        <button
                          onClick={() => {
                            if (correlatedPopupTab === 'groups') {
                              handleAddGroupAsEvidence(selectedCorrelatedItem);
                            } else {
                              handleAddAlertAsEvidence(selectedCorrelatedItem);
                            }
                          }}
                          className="shrink-0 flex items-center gap-3 px-10 py-5 bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-[0.2em] rounded-2xl transition-all"
                        >
                          <Anchor className="w-5 h-5 stroke-[3px]" />
                          Capture Evidence
                        </button>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-3 gap-6">
                        {[
                          { label: 'Intelligence ID', value: selectedCorrelatedItem.rule_id, icon: Cpu },
                          { label: 'Target Entity', value: selectedCorrelatedItem.agent_name || selectedCorrelatedItem.latest_agent_name, icon: Server },
                          { label: 'Pivot Account', value: selectedCorrelatedItem.source_ip || selectedCorrelatedItem.latest_source_ip, icon: User },
                          { label: 'Discovery', value: selectedCorrelatedItem.timestamp ? new Date(selectedCorrelatedItem.timestamp).toLocaleString() : null, icon: Clock },
                          { label: 'Operational Status', value: selectedCorrelatedItem.status || 'Active Analysis', icon: Activity },
                          { label: 'Timeline First Seen', value: selectedCorrelatedItem.first_seen ? formatRelativeTime(selectedCorrelatedItem.first_seen) : null, icon: Clock },
                        ].filter(item => item.value).map((item, idx) => (
                          <div key={idx} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-3">
                               <item.icon className="w-4 h-4 text-neutral-600 group-hover:text-white transition-colors" />
                               <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{item.label}</p>
                            </div>
                            <p className="text-sm font-bold text-neutral-300 truncate tracking-tight">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Alerts in this group section */}
                      {correlatedPopupTab === 'groups' && (
                        <div className="space-y-8">
                           <div className="flex items-center justify-between border-b border-white/5 pb-4">
                              <div className="flex items-center gap-3">
                                 <List className="w-5 h-5 text-blue-400" />
                                 <h5 className="text-sm font-black text-white uppercase tracking-widest">Alerts in this Cluster</h5>
                              </div>
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{groupAlerts.length} Active Events</span>
                           </div>

                           {groupAlertsLoading ? (
                             <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
                                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Decrypting Group Data...</span>
                             </div>
                           ) : (
                             <div className="space-y-4">
                                {groupAlerts.map((alert, i) => (
                                   <div key={i} className="p-6 bg-white/[0.01] border border-white/5 rounded-[2rem] hover:bg-white/[0.03] transition-all group/alert relative overflow-hidden">
                                      <div className="flex items-start justify-between gap-8 relative z-10">
                                         <div className="space-y-6 flex-1">
                                            <div className="flex items-center gap-4">
                                               <SeverityBadge severity={alert.severity} />
                                               <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase">{alert.alert_number || alert.id.slice(0,10)}</span>
                                               <span className="text-[10px] text-neutral-500">•</span>
                                               <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{new Date(alert.timestamp).toLocaleString()}</span>
                                            </div>
                                            
                                            <h6 className="text-lg font-bold text-white leading-snug">{alert.description}</h6>

                                            <div className="grid grid-cols-2 gap-8 py-6 border-y border-white/[0.03]">
                                               <div className="space-y-1">
                                                  <span className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Involved Agent</span>
                                                  <p className="text-[11px] font-bold text-neutral-400 font-mono italic">{alert.agent_name}</p>
                                               </div>
                                               <div className="space-y-1">
                                                  <span className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">Network Context</span>
                                                  <p className="text-[11px] font-bold text-neutral-400 font-mono">{alert.source_ip || 'Internal System event'}</p>
                                               </div>
                                            </div>

                                            {/* Nested forensic telemetry for each alert */}
                                            <div className="bg-black/40 rounded-2xl p-6 font-mono text-[10px] text-emerald-500/80 leading-relaxed overflow-x-auto border border-white/5 uppercase select-all">
                                               {alert.full_log || (typeof alert.raw_log === 'string' ? alert.raw_log : JSON.stringify(alert.raw_log, null, 2))}
                                            </div>
                                         </div>

                                         <div className="flex flex-col gap-2 opacity-0 group-hover/alert:opacity-100 transition-opacity">
                                            <button 
                                               onClick={() => onAddAlertAsEvidence(alert)}
                                               className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
                                               title="Add to evidence"
                                            >
                                               <Anchor className="w-5 h-5" />
                                            </button>
                                         </div>
                                      </div>
                                   </div>
                                ))}
                             </div>
                           )}
                        </div>
                      )}

                      {/* Log data telemetry (for single alert view) */}
                      {correlatedPopupTab === 'alerts' && selectedCorrelatedItem.raw_log && (
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Forensic Log Telemetry</p>
                             </div>
                             <div className="flex bg-white/[0.02] border border-white/5 rounded-2xl p-1">
                               <button
                                 onClick={() => setLogViewMode('parsed')}
                                 className={`px-5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${logViewMode === 'parsed' ? 'bg-white/10 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
                               >
                                 Analysis
                               </button>
                               <button
                                 onClick={() => setLogViewMode('raw')}
                                 className={`px-5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${logViewMode === 'raw' ? 'bg-white/10 text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
                               >
                                 Raw
                               </button>
                             </div>
                           </div>

                           <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                           {logViewMode === 'parsed' ? (
                             <table className="w-full text-left bg-transparent">
                               <tbody className="divide-y divide-white/5">
                                 {(() => {
                                   const raw = typeof selectedCorrelatedItem.raw_log === 'string'
                                     ? JSON.parse(selectedCorrelatedItem.raw_log || '{}')
                                     : (selectedCorrelatedItem.raw_log || {})
                                   const rule = raw.rule || {}
                                   const agent = raw.agent || {}
                                   return [
                                     { key: 'Event Log', value: raw.full_log },
                                     { key: 'Execution Path', value: logViewMode === 'parsed' ? (raw.event?.module || raw.source?.address) : null },
                                     { key: 'MITRE Technique', value: rule.mitre?.id?.join(', ') },
                                     { key: 'Rule Signature', value: rule.description },
                                     { key: 'Agent Version', value: agent.version },
                                     { key: 'System Host', value: agent.name },
                                   ].filter(r => r.value).map((row, i) => (
                                     <tr key={i} className="group/row hover:bg-white/[0.02] transition-colors">
                                       <td className="w-1/4 p-5 text-[10px] font-bold text-neutral-600 uppercase tracking-widest align-top border-r border-white/5">{row.key}</td>
                                       <td className="p-5 text-[11px] font-medium text-neutral-300 font-mono leading-relaxed break-all select-all">{row.value}</td>
                                     </tr>
                                   ))
                                 })()}
                               </tbody>
                             </table>
                           ) : (
                             <div className="p-8 font-mono text-[11px] text-emerald-500/80 leading-relaxed overflow-x-auto whitespace-pre bg-black/40">
                               {/* Raw Log content */}
                               {typeof selectedCorrelatedItem.raw_log === 'string' 
                                 ? selectedCorrelatedItem.raw_log 
                                 : JSON.stringify(selectedCorrelatedItem.raw_log, null, 2)}
                             </div>
                           )}
                           </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20">
                      <Layers className="w-16 h-16 text-white" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em]">Select Forensic Hub Item</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTimelineAlertPopup && selectedTimelineAlert && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-8 w-[400px] max-h-[75vh] bg-neutral-950 border border-neutral-800 rounded-[2rem] z-[260] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={selectedTimelineAlert.severity} />
                <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase">
                  {selectedTimelineAlert.alert_number || selectedTimelineAlert.id?.slice(0,10)}
                </span>
                {selectedTimelineAlert.id === data.linkedAlert?.id && (
                  <span className="text-[8px] font-black text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full uppercase tracking-widest bg-black">TRIGGER ALERT</span>
                )}
              </div>
              <button onClick={() => setShowTimelineAlertPopup(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5 text-neutral-500 hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              
              {/* Description */}
              <div className="space-y-1">
                <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Incident Objective</p>
                <p className="text-base text-neutral-200 font-bold leading-snug">{selectedTimelineAlert.description}</p>
              </div>

              {/* Key fields grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Timestamp', value: new Date(selectedTimelineAlert.timestamp).toLocaleString() },
                  { label: 'Agent', value: selectedTimelineAlert.agent_name },
                  { label: 'Rule ID', value: selectedTimelineAlert.rule_id },
                  { label: 'Rule Level', value: selectedTimelineAlert.rule_level },
                  { label: 'Source IP', value: getSourceIp(selectedTimelineAlert) },
                  { label: 'Status', value: selectedTimelineAlert.status },
                ].filter(f => f.value).map(field => (
                  <div key={field.label} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest mb-1">{field.label}</p>
                    <p className="text-[11px] text-neutral-400 font-bold truncate">{field.value}</p>
                  </div>
                ))}
              </div>

              {/* MITRE ATT&CK */}
              {(() => {
                const raw = typeof selectedTimelineAlert.raw_log === 'string'
                  ? (() => { try { return JSON.parse(selectedTimelineAlert.raw_log) } catch { return {} } })()
                  : (selectedTimelineAlert.raw_log || {})
                const mitre = raw?.rule?.mitre
                if (!mitre?.id?.length) return null
                return (
                  <div>
                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-3">MITRE ATT&CK Matrix</p>
                    <div className="flex flex-wrap gap-2">
                      {mitre.id.map((id: string, i: number) => (
                        <span key={id} className="text-[9px] font-black px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 uppercase tracking-widest">
                          {id}{mitre.tactic?.[i] ? ` • ${mitre.tactic[i]}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Raw log toggle */}
              {selectedTimelineAlert.raw_log && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Forensic Telemetry</p>
                    <div className="flex bg-white/[0.02] border border-white/5 rounded-xl p-0.5">
                      <button
                        onClick={() => setLogViewMode('parsed')}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${logViewMode === 'parsed' ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-600'}`}
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => setLogViewMode('raw')}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${logViewMode === 'raw' ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-600'}`}
                      >
                        Binary
                      </button>
                    </div>
                  </div>

                  {logViewMode === 'parsed' ? (
                    <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/40">
                      {(() => {
                        const raw = typeof selectedTimelineAlert.raw_log === 'string'
                          ? (() => { try { return JSON.parse(selectedTimelineAlert.raw_log) } catch { return {} } })()
                          : (selectedTimelineAlert.raw_log || {})
                        const rows = [
                          { key: 'Full Log', value: raw.full_log },
                          { key: 'Location', value: raw.location },
                          { key: 'Decoder', value: raw.decoder?.name },
                          { key: 'Manager', value: raw.manager?.name },
                        ].filter(r => r.value)
                        return (
                          <table className="w-full text-left">
                            <tbody className="divide-y divide-white/5">
                              {rows.map((row, i) => (
                                <tr key={row.key} className={i % 2 === 0 ? 'bg-white/[0.01]' : ''}>
                                  <td className="px-4 py-3 text-[8px] font-black text-neutral-600 uppercase w-1/3 border-r border-white/5">{row.key}</td>
                                  <td className="px-4 py-3 text-[10px] text-neutral-400 font-mono break-all">{String(row.value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="relative group/raw">
                      <button
                        onClick={() => {
                          const raw = typeof selectedTimelineAlert.raw_log === 'string'
                            ? selectedTimelineAlert.raw_log
                            : JSON.stringify(selectedTimelineAlert.raw_log, null, 2)
                          navigator.clipboard.writeText(raw)
                          showSuccessToast('Log copied to clipboard')
                        }}
                        className="absolute top-4 right-4 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-[9px] font-black text-neutral-400 hover:text-white transition-all z-20 opacity-0 group-hover/raw:opacity-100 border border-neutral-700"
                      >
                        Copy Raw
                      </button>
                      <pre className="bg-black border border-white/5 rounded-2xl p-6 text-[10px] text-emerald-500/80 overflow-auto max-h-60 font-mono scrollbar-hide select-all">
                        {typeof selectedTimelineAlert.raw_log === 'string'
                          ? (() => { try { return JSON.stringify(JSON.parse(selectedTimelineAlert.raw_log), null, 2) } catch { return selectedTimelineAlert.raw_log } })()
                          : JSON.stringify(selectedTimelineAlert.raw_log, null, 2)
                        }
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-6 border-t border-neutral-800 flex gap-3 bg-neutral-900/50">
              <button
                onClick={() => {
                  handleAddAlertAsEvidence(selectedTimelineAlert)
                  setShowTimelineAlertPopup(false)
                }}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl text-[10px] font-black text-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/10"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                Capture Evidence
              </button>
              <button
                onClick={() => setShowTimelineAlertPopup(false)}
                className="px-6 py-4 bg-neutral-800 border border-neutral-700 rounded-2xl text-[10px] font-black text-neutral-500 hover:text-white transition-all uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Entity Behavior Centered Popup - AT ROOT LEVEL FOR VISIBILITY */}
      <AnimatePresence>
        {showEntityBehaviorPopup && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onMouseLeave={() => setShowEntityBehaviorPopup(false)}
              className="w-[820px] max-h-[95vh] bg-black border border-white/10 flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden"
            >
              {!entityDrift ? (
                <div className="p-16 flex flex-col items-center justify-center space-y-8">
                  <div className="w-16 h-16 rounded-full border-2 border-t-white border-white/5 animate-spin" />
                  <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.4em]">Synthesizing Behavioral Model</p>
                </div>
              ) : (
                <>
                  <div className="p-10 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-700",
                        entityDrift.volume_ratio > 2 
                          ? "bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                          : "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                      )}>
                        <Activity className={cn(
                          "w-6 h-6 transition-colors duration-700",
                          entityDrift.volume_ratio > 2 ? "text-red-500" : "text-emerald-500"
                        )} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                          Entity Behavioral Drift
                          {entityDrift.volume_ratio > 2 ? (
                            <span className="px-2.5 py-0.5 bg-red-950/40 border border-red-500/50 rounded-full text-[9px] font-black tracking-[0.2em] text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] uppercase animate-pulse">
                              Alert
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-emerald-950/40 border border-emerald-500/50 rounded-full text-[9px] font-black tracking-[0.2em] text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] uppercase">
                              Low
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-neutral-500 font-mono mt-0.5">{entityDrift.entity_name}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowEntityBehaviorPopup(false)} 
                      className="p-3 hover:bg-white/[0.03] rounded-xl transition-all group"
                    >
                      <X className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                    </button>
                  </div>

                  <div className="flex-1 p-10 space-y-10 overflow-hidden">
                    <div className="grid grid-cols-2 gap-10 items-start">
                       {/* Left: Score & Vol Matrix */}
                       <div className="space-y-10">
                          {/* Risk score */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Risk Assessment</span>
                              <span className={cn(
                                "text-4xl font-bold tracking-tighter transition-all duration-700",
                                entityDrift.volume_ratio > 2 
                                  ? 'text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                                  : 'text-emerald-500'
                              )}>
                                {Math.min(100, Math.round(entityDrift.volume_ratio * 20 + entityDrift.new_rules_count * 15))}
                                <span className="text-lg text-neutral-600 ml-1">/ 100</span>
                              </span>
                            </div>
                            <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.round(entityDrift.volume_ratio * 20 + entityDrift.new_rules_count * 15))}%` }}
                                className={cn(
                                  "h-full transition-colors duration-700",
                                  entityDrift.volume_ratio > 2 ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Volume Metrics</p>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <p className="text-[9px] font-medium text-neutral-600 uppercase mb-4 tracking-widest">Baseline Avg</p>
                                <p className="text-4xl font-bold text-neutral-200 tracking-tighter">{entityDrift.baseline_daily}</p>
                                <p className="text-[10px] text-neutral-600 mt-2 font-medium tracking-wide italic">freq / 24h</p>
                              </div>
                              <div className={cn(
                                "p-6 border rounded-2xl transition-all duration-700",
                                entityDrift.volume_ratio > 2 
                                  ? 'bg-red-500/[0.02] border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.05)]' 
                                  : 'bg-emerald-500/[0.02] border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]'
                              )}>
                                <p className="text-[9px] font-medium text-neutral-600 uppercase mb-4 tracking-widest">Active Velocity</p>
                                <p className={cn(
                                  "text-4xl font-bold tracking-tighter",
                                  entityDrift.volume_ratio > 2 ? 'text-red-500' : 'text-emerald-500'
                                )}>
                                  {entityDrift.current_daily}
                                </p>
                                <p className="text-[10px] text-neutral-600 mt-2 font-medium tracking-wide italic lowercase">alerts detected</p>
                              </div>
                            </div>
                          </div>
                       </div>

                       {/* Right: Rules & Interpretation */}
                       <div className="space-y-10">
                          {/* Analysis */}
                          <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl h-full flex flex-col relative overflow-hidden group/audit">
                            {/* Forensic accent mark */}
                            <div className={cn(
                              "absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 transition-colors duration-700",
                              entityDrift.volume_ratio > 2 ? "bg-red-500" : "bg-emerald-500"
                            )} />
                            
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em] mb-6">Forensic Perspective</p>
                            <div className="flex flex-col gap-6 relative z-10">
                              <p className="text-base text-neutral-300 leading-relaxed font-medium">
                                {entityDrift.volume_ratio > 3
                                  ? `${entityDrift.entity_name} is generating ${entityDrift.volume_ratio.toFixed(1)}x more alerts than historical norms. This volatility spike is consistent with active exploitation or lateral traversal.`
                                  : entityDrift.volume_ratio > 1.5
                                  ? `${entityDrift.entity_name} shows moderately elevated activity. This profile often aligns with reconnaissance or initial discovery phases.`
                                  : entityDrift.new_rules_count > 0
                                  ? `${entityDrift.entity_name} shows distinct behavioral shifts via new rule detections, indicating a change in operational profile.`
                                  : `${entityDrift.entity_name} is behaving within established historical parameters.`
                                }
                              </p>
                              <div className="flex items-center gap-4">
                                {entityDrift.volume_ratio > 2 ? (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Critical Anomaly</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Nominal State</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Evidence Button */}
                          <button
                            onClick={() => handleAddDriftAsEvidence(entityDrift)}
                            className={cn(
                              "w-full py-5 text-black hover:bg-neutral-200 transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 mt-auto",
                              entityDrift.volume_ratio > 2 ? "bg-red-500" : "bg-emerald-500"
                            )}
                          >
                            <Plus className="w-4 h-4 text-black stroke-[4px]" />
                            Capture Drift Evidence
                          </button>
                       </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Universal Alert Investigator Popup */}
      <AnimatePresence>
        {showGlobalSearch && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              className="w-full max-w-6xl h-[90vh] bg-neutral-950 border border-neutral-900 rounded-2xl shadow-2xl flex flex-col relative"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-neutral-900 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-medium text-white tracking-tight">Universal Alert Investigator</h2>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Cross-organization incident intelligence and alert correlation</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGlobalSearch(false)}
                  className="p-2.5 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/[0.08]"
                >
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Search & Filter Bar */}
                <div className="p-8 border-b border-neutral-900 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-neutral-600 group-focus-within:text-white transition-colors" />
                      </div>
                      <input 
                        type="text"
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGlobalAlertSearch()}
                        placeholder="Search by Description, IP, Agent, or Rule..."
                        className="w-full bg-black border border-neutral-800 focus:border-white/20 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none transition-all shadow-sm"
                      />
                    </div>
                    <button 
                      onClick={handleGlobalAlertSearch}
                      disabled={isSearchingGlobal}
                      className="px-6 py-3 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
                    >
                      {isSearchingGlobal ? 'Searching...' : 'Search Alerts'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    {/* Severity Filters */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity</span>
                      <div className="flex bg-black border border-neutral-800 rounded-lg p-0.5">
                        {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                          <button
                            key={sev}
                            onClick={() => setGlobalSearchSeverity(sev)}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
                              globalSearchSeverity === sev 
                                ? "bg-white/10 text-white" 
                                : "text-neutral-500 hover:text-neutral-300"
                            )}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status Filters */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</span>
                      <div className="flex bg-black border border-neutral-800 rounded-lg p-0.5">
                        {['All', 'Active', 'Resolved'].map((status) => (
                          <button
                            key={status}
                            onClick={() => setGlobalSearchStatus(status)}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
                              globalSearchStatus === status 
                                ? "bg-white/10 text-white" 
                                : "text-neutral-500 hover:text-neutral-300"
                            )}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timeframe Filters */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Timeframe</span>
                      <div className="flex bg-black border border-neutral-800 rounded-lg p-0.5">
                        {[
                          { label: 'All Time', value: 'All' },
                          { label: '24 Hours', value: '24h' },
                          { label: '7 Days', value: '7d' },
                          { label: '30 Days', value: '30d' }
                        ].map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setGlobalSearchTimeframe(t.value)}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap",
                              globalSearchTimeframe === t.value 
                                ? "bg-white/10 text-white" 
                                : "text-neutral-500 hover:text-neutral-300"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-neutral-950/50">
                  {isSearchingGlobal ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                      <RefreshCw className="w-8 h-8 text-white animate-spin" />
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] animate-pulse">Running organization-wide intelligence query</p>
                    </div>
                  ) : globalSearchResults.length > 0 ? (
                    <div className="space-y-4 max-w-4xl mx-auto">
                      {globalSearchResults.map((alert) => (
                        <div 
                          key={alert.id}
                          className="group flex items-center justify-between p-4 bg-black border border-neutral-900 hover:border-neutral-700 rounded-xl transition-all cursor-pointer"
                          onClick={() => setSelectedGlobalAlert(alert)}
                        >
                          <div className="flex items-center gap-5 overflow-hidden">
                            <div className={cn(
                              "w-1 h-10 rounded-full",
                              alert.severity === 'Critical' ? 'bg-red-500' :
                              alert.severity === 'High' ? 'bg-orange-500' :
                              alert.severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            )} />
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-3 mb-1">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                  alert.severity === 'Critical' ? 'bg-red-500/10 text-red-500' :
                                  alert.severity === 'High' ? 'bg-orange-500/10 text-orange-500' :
                                  alert.severity === 'Medium' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'
                                )}>
                                  {alert.severity}
                                </span>
                                <span className="text-[9px] font-mono text-neutral-600">{alert.alert_number || alert.id.slice(0,8)}</span>
                                <div className="w-1 h-1 rounded-full bg-neutral-800" />
                                <span className="text-[10px] text-neutral-400 group-hover:text-white transition-colors truncate font-medium">{alert.description}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 opacity-60">
                                  <Globe className="w-3 h-3 text-neutral-500" />
                                  <span className="text-[10px] font-mono text-neutral-500">{alert.source_ip || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-60">
                                  <Cpu className="w-3 h-3 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">{alert.agent_name || 'Network'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-60">
                                  <Clock className="w-3 h-3 text-neutral-500" />
                                  <span className="text-[10px] text-neutral-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddAlertFromSearchAsEvidence(alert);
                              }}
                              className="p-2 hover:bg-white/10 rounded-lg transition-all border border-transparent hover:border-white/10"
                              title="Add as Evidence"
                            >
                              <Anchor className="w-4 h-4 text-neutral-400" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-neutral-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                      <Target className="w-8 h-8 text-neutral-500 mb-4" />
                      <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">No matching intelligence</h3>
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Alert Overlay (Popup on top) */}
              <AnimatePresence>
                {selectedGlobalAlert && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-neutral-950/60 backdrop-blur-md">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="w-full max-w-2xl bg-black border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-full"
                    >
                      <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <SeverityBadge severity={selectedGlobalAlert.severity} />
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">{selectedGlobalAlert.alert_number || 'Alert Detail'}</h3>
                        </div>
                        <button 
                          onClick={() => setSelectedGlobalAlert(null)}
                          className="p-2 hover:bg-neutral-900 rounded-xl transition-all"
                        >
                          <X className="w-4 h-4 text-neutral-500" />
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Description</label>
                          <p className="text-sm text-neutral-200 leading-relaxed bg-neutral-900/40 p-4 rounded-xl border border-neutral-800/50">
                            {selectedGlobalAlert.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: 'Rule ID', value: selectedGlobalAlert.rule_id, icon: Terminal },
                            { label: 'Source IP', value: getSourceIp(selectedGlobalAlert), icon: Globe },
                            { label: 'Agent', value: selectedGlobalAlert.agent_name, icon: Cpu },
                            { label: 'Timestamp', value: new Date(selectedGlobalAlert.timestamp).toLocaleString(), icon: Clock },
                          ].map((item, i) => (
                            <div key={i} className="p-4 bg-neutral-900/30 border border-neutral-900 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <item.icon className="w-3 h-3 text-neutral-600" />
                                <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{item.label}</span>
                              </div>
                              <p className="text-xs font-mono text-neutral-300 break-all">{item.value || 'N/A'}</p>
                            </div>
                          ))}
                        </div>

                        {selectedGlobalAlert.raw_log && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Raw Log Payload</label>
                              <button 
                                onClick={() => {
                                  const text = typeof selectedGlobalAlert.raw_log === 'string' ? selectedGlobalAlert.raw_log : JSON.stringify(selectedGlobalAlert.raw_log);
                                  navigator.clipboard.writeText(text);
                                  addNotification({ type: 'rule_deployed', title: 'Copied', description: 'Log copied to clipboard' });
                                }}
                                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1"
                              >
                                <Copy className="w-2.5 h-2.5" /> Copy Log
                              </button>
                            </div>
                            <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-0.5 font-mono text-[11px] text-neutral-400 overflow-x-auto overflow-y-auto max-h-96 scrollbar-hide">
                              <ParsedLogTable data={selectedGlobalAlert.raw_log} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-6 border-t border-neutral-900 flex gap-3 bg-neutral-950/30 rounded-b-2xl">
                        <button 
                          onClick={() => {
                            handleAddAlertFromSearchAsEvidence(selectedGlobalAlert);
                            setSelectedGlobalAlert(null);
                          }}
                          className="flex-1 py-3 bg-white hover:bg-neutral-200 text-black rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2"
                        >
                          <Anchor className="w-3.5 h-3.5" /> Capture as Evidence
                        </button>
                        <button 
                          onClick={() => setSelectedGlobalAlert(null)}
                          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border border-neutral-800 transition-all shadow-inner"
                        >
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
