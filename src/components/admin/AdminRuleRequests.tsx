import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  MessageSquare,
  ChevronRight,
  Filter,
  Check,
  X,
  Code,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, getSeverityFromLevel } from '../../lib/utils';
import { SeverityBadge } from '../ui/StatusElements';

export default function AdminRuleRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'deployed'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('rule_approval_requests')
      .select('*, clients(id, name, wazuh_group)')
      .order('submitted_at', { ascending: false });
    
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data } = await query;
    setRequests(data || []);
    setLoading(false);
  };

  const computeRiskScore = (rule: any) => {
    let score = 0;
    const flags: string[] = [];

    if (rule.regex_pattern) {
      if (/(\w+\+)+/.test(rule.regex_pattern) || /(\w+\*)+/.test(rule.regex_pattern)) {
        score += 40;
        flags.push('Regex may cause catastrophic backtracking — performance risk');
      }
      if (rule.regex_pattern === '.*' || rule.regex_pattern === '.+') {
        score += 50;
        flags.push('Regex matches everything — will generate excessive false positives');
      }
      if (rule.regex_pattern.length < 4) {
        score += 20;
        flags.push('Regex pattern is very short — likely to generate false positives');
      }
    }

    if (rule.match_pattern) {
      if (rule.match_pattern.length < 4) {
        score += 15;
        flags.push('Match pattern is very short — may match unintended log lines');
      }
      const dangerous = ['exec', 'eval', 'system('];
      if (dangerous.some(d => rule.match_pattern.toLowerCase().includes(d))) {
        score += 10;
        flags.push('Pattern references code execution keywords — verify intent');
      }
    }

    if (rule.level >= 13) {
      score += 15;
      flags.push('Rule level 13-15 triggers critical alerts — ensure pattern is precise');
    }

    if (!rule.match_pattern && !rule.regex_pattern) {
      score += 60;
      flags.push('No match or regex pattern defined — rule will never trigger or may error');
    }

    return { score: Math.min(100, score), flags };
  };

  const handleApproveRule = async (request: any) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Update request status
      await supabase.from('rule_approval_requests').update({
        status: 'approved',
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        review_notes: reviewNotes
      }).eq('id', request.id);

      // 2. Update the custom_rule
      await supabase.from('custom_rules').update({
        approval_status: 'approved',
        deployed: false,
        status: 'active'
      }).eq('id', request.custom_rule_id);

      // 3. Audit log
      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'rule_approved',
        target_type: 'custom_rule',
        target_id: request.custom_rule_id,
        target_name: request.rule_name,
        details: {
          client_id: request.client_id,
          client_name: request.clients?.name,
          rule_id: request.rule_id,
          review_notes: reviewNotes,
          risk_score: computeRiskScore(request).score
        }
      });

      setIsReviewModalOpen(false);
      setReviewNotes('');
      fetchRequests();
    } catch (err) {
      console.error('Error approving rule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectRule = async (request: any) => {
    if (!rejectionReason) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('rule_approval_requests').update({
        status: 'rejected',
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      }).eq('id', request.id);

      await supabase.from('custom_rules').update({
        approval_status: 'rejected',
        status: 'inactive',
        deployed: false
      }).eq('id', request.custom_rule_id);

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'rule_rejected',
        target_type: 'custom_rule',
        target_id: request.custom_rule_id,
        target_name: request.rule_name,
        details: {
          client_id: request.client_id,
          rejection_reason: rejectionReason
        }
      });

      setIsReviewModalOpen(false);
      setRejectionReason('');
      fetchRequests();
    } catch (err) {
      console.error('Error rejecting rule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const RiskScoreBadge = ({ score }: { score: number }) => {
    let color = "bg-green-600/10 text-green-500 border-green-500/20";
    let label = "LOW RISK";
    if (score > 80) {
      color = "bg-red-600 text-white font-black animate-pulse shadow-lg shadow-red-600/20 px-2 animate-bounce";
      label = "CRITICAL RISK";
    } else if (score > 60) {
      color = "bg-orange-600/20 text-orange-500 border-orange-500/30";
      label = "HIGH RISK";
    } else if (score > 30) {
      color = "bg-yellow-600/20 text-yellow-500 border-yellow-500/30";
      label = "MEDIUM RISK";
    }
    return (
      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", color)}>
        {label} ({score})
      </span>
    );
  };

  const generateXml = (rule: any) => {
    return `<group name="kastronsec_custom,">
  <rule id="${rule.rule_id}" level="${rule.level}">
    <description>${rule.description}</description>
    ${rule.match_pattern ? `<match>${rule.match_pattern}</match>` : ''}
    ${rule.regex_pattern ? `<regex>${rule.regex_pattern}</regex>` : ''}
    ${rule.mitre_id ? `<mitre>
      <id>${rule.mitre_id}</id>
    </mitre>` : ''}
  </rule>
</group>`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-8 space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Rule Approval Pipeline</h2>
          <p className="text-xs text-neutral-500 mt-1">Review and validate custom detection logic across the fleet</p>
        </div>
        <div className="flex bg-neutral-900/50 p-1 rounded-lg border border-neutral-800">
          {(['pending', 'approved', 'rejected', 'deployed', 'all'] as const).map(f => (
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

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center">
            <Clock className="w-10 h-10 text-neutral-800 animate-spin mx-auto mb-4" />
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Scanning Queue...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center bg-neutral-900/20 border border-neutral-800 rounded-2xl">
            <CheckCircle2 className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">No matching requests found in this queue</p>
          </div>
        ) : (
          requests.map(request => {
            const risk = computeRiskScore(request);
            return (
              <div key={request.id} className="bg-black border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-all group">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 bg-blue-600/10 text-blue-400 text-[10px] font-black rounded uppercase tracking-widest border border-blue-500/20">
                        {request.clients?.name}
                      </div>
                      <ChevronRight className="w-3 h-3 text-neutral-700" />
                      <h3 className="text-base font-bold text-white tracking-tight">{request.rule_name}</h3>
                      <SeverityBadge severity={getSeverityFromLevel(request.level)} />
                    </div>
                    
                    <p className="text-sm text-neutral-400 leading-relaxed max-w-3xl">
                      {request.description}
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Log Source</label>
                        <p className="text-xs text-neutral-300 font-mono">{request.log_source || 'Any'}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Risk Analysis</label>
                        <div className="flex items-center gap-2">
                          <RiskScoreBadge score={risk.score} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Submitted</label>
                        <p className="text-xs text-neutral-300">{new Date(request.submitted_at).toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Status</label>
                        <span className={cn(
                          "text-[10px] font-black uppercase",
                          request.status === 'pending' ? 'text-yellow-500' :
                          request.status === 'approved' ? 'text-green-500' :
                          request.status === 'rejected' ? 'text-red-500' : 'text-blue-500'
                        )}>{request.status}</span>
                      </div>
                    </div>

                    {risk.flags.length > 0 && (
                      <div className="p-3 bg-red-600/5 border border-red-500/10 rounded-lg space-y-2">
                        {risk.flags.map((flag, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[10px] text-red-400">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span className="font-bold opacity-80">{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => { setSelectedRequest(request); setIsReviewModalOpen(true); }}
                      className="px-6 py-2.5 bg-red-600 rounded-lg text-xs font-black text-white uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/10 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Review & Process
                    </button>
                    {request.status === 'approved' && (
                      <div className="flex items-center gap-1 text-[9px] text-green-500 font-bold uppercase justify-center mt-2">
                        <CheckCircle2 className="w-3 h-3" />
                        Awaiting Deployment
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {isReviewModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReviewModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-8 py-6 border-b border-neutral-800 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">Rule Audit & Approval</h3>
                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-0.5">Request ID: {selectedRequest.id}</p>
                  </div>
                </div>
                <button onClick={() => setIsReviewModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 flex gap-8">
                {/* Left Side: Rule Details */}
                <div className="flex-1 space-y-8">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       Metadata <ChevronRight className="w-3 h-3" />
                    </h4>
                    <div className="grid grid-cols-2 gap-6 bg-black/50 p-6 rounded-2xl border border-neutral-800">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Client Environment</label>
                        <p className="text-sm text-blue-400 font-bold">{selectedRequest.clients?.name} ({selectedRequest.clients?.wazuh_group})</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Internal Rule ID</label>
                        <p className="text-sm text-white font-mono">{selectedRequest.rule_id}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Severity Intent</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-bold">Level {selectedRequest.level}</span>
                          <SeverityBadge severity={getSeverityFromLevel(selectedRequest.level)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Log Source Context</label>
                        <p className="text-sm text-neutral-400 uppercase font-black">{selectedRequest.log_source || 'ANY SOURCE'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       Logic Analysis <ChevronRight className="w-3 h-3" />
                    </h4>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-2">
                           <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Match Pattern</label>
                           <p className="text-xs text-white font-mono bg-neutral-900 p-2 rounded border border-neutral-800 truncate">{selectedRequest.match_pattern || 'NONE'}</p>
                        </div>
                        <div className="p-4 bg-black rounded-xl border border-neutral-800 space-y-2">
                           <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Regex Pattern</label>
                           <p className="text-xs text-white font-mono bg-neutral-900 p-2 rounded border border-neutral-800 truncate">{selectedRequest.regex_pattern || 'NONE'}</p>
                        </div>
                      </div>

                      <div className="p-6 bg-red-600/5 rounded-2xl border border-red-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">Platform Risk Assessment</label>
                          <RiskScoreBadge score={computeRiskScore(selectedRequest).score} />
                        </div>
                        <div className="space-y-2">
                          {computeRiskScore(selectedRequest).flags.map((flag, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-[11px] text-red-200">
                              <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                              <span className="opacity-80 font-medium leading-relaxed">{flag}</span>
                            </div>
                          ))}
                          {computeRiskScore(selectedRequest).flags.length === 0 && (
                            <div className="flex items-center gap-2 text-[11px] text-green-500 font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              No logic risks detected. Pattern appears standardized.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Side: Deployment Preview & Actions */}
                <div className="w-96 space-y-8 flex flex-col">
                  <section className="flex-1 space-y-4">
                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       Wazuh XML Preview <ChevronRight className="w-3 h-3" />
                    </h4>
                    <div className="bg-black rounded-2xl p-6 font-mono text-[11px] text-neutral-300 border border-neutral-800 h-full max-h-[400px] overflow-auto">
                        <pre className="whitespace-pre-wrap">{generateXml(selectedRequest)}</pre>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Review Notes (Internals)</label>
                        <textarea 
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Add notes for the team or client..."
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 transition-all h-24 max-h-32 scrollbar-hide"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {selectedRequest.status === 'pending' ? (
                        <>
                          <button 
                            disabled={isSubmitting}
                            onClick={() => handleApproveRule(selectedRequest)}
                            className="w-full py-4 bg-green-600 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-green-500 transition-all shadow-xl shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <Check className="w-5 h-5" />
                            Approve & Queue for Deployment
                          </button>
                          
                          <div className="space-y-2">
                            <input 
                              type="text"
                              placeholder="Reason for rejection (Required)..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-[11px] text-white focus:outline-none focus:border-red-500"
                            />
                            <button 
                              disabled={isSubmitting || !rejectionReason}
                              onClick={() => handleRejectRule(selectedRequest)}
                              className="w-full py-3 bg-red-600/10 border border-red-600/20 rounded-xl text-xs font-black text-red-500 uppercase tracking-widest hover:bg-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                            >
                              <X className="w-5 h-5" />
                              Reject Rule
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-neutral-700" />
                          <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Review Completed</p>
                          <p className="text-[11px] text-neutral-600 font-bold uppercase">{selectedRequest.status} by {selectedRequest.reviewed_by}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
