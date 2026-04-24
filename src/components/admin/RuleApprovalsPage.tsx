import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  X, 
  Clock, 
  ChevronRight,
  Filter,
  Search,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, formatRelativeTime } from '../../lib/utils';
import { useIsAdmin } from '../../hooks/useIsAdmin';

// Risk score helper
const computeRiskScore = (rule: any) => {
  let score = 0
  const flags: string[] = []

  if (rule.regex_pattern) {
    if (/(\w+\+)+/.test(rule.regex_pattern) || /(\w+\*)+/.test(rule.regex_pattern)) {
      score += 40
      flags.push('Regex may cause catastrophic backtracking')
    }
    if (rule.regex_pattern === '.*' || rule.regex_pattern === '.+') {
      score += 50
      flags.push('Regex matches everything — excessive false positives risk')
    }
    if (rule.regex_pattern.length < 4) {
      score += 20
      flags.push('Regex too short — broad matching risk')
    }
  }

  if (rule.match_pattern && rule.match_pattern.length < 4) {
    score += 15
    flags.push('Match pattern very short — may match unintended logs')
  }

  if (!rule.match_pattern && !rule.regex_pattern) {
    score += 60
    flags.push('No pattern defined — rule will never trigger')
  }

  if (rule.level >= 13) {
    score += 15
    flags.push('Level 13-15 generates critical alerts — ensure pattern is precise')
  }

  return { score: Math.min(100, score), flags }
}

const RiskScoreBadge = ({ score }: { score: number }) => (
  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
    score <= 30 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
    score <= 60 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
    score <= 80 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
    'bg-red-500/10 text-red-400 border border-red-500/20'
  }`}>
    {score <= 30 ? 'Low Risk' : score <= 60 ? 'Med Risk' : score <= 80 ? 'High Risk' : 'Critical Risk'} · {score}
  </span>
)

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    deployed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  }
  return (
    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded uppercase border", styles[status] || 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20')}>
      {status}
    </span>
  )
}

const getLevelLabel = (level: number) => {
  if (level <= 4) return 'Low';
  if (level <= 9) return 'Medium';
  if (level <= 12) return 'High';
  return 'Critical';
}

const RuleApprovalsPage: React.FC = () => {
  const { isAdmin, adminLoading } = useIsAdmin();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [rejectingRequest, setRejectingRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rule_approval_requests')
        .select(`
          *,
          clients(id, name, wazuh_group)
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchRequests();
    }
  }, [isAdmin]);

  const handleQuickApprove = async (request: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('rule_approval_requests').update({
        status: 'approved',
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
        approved_at: new Date().toISOString()
      }).eq('id', request.id)

      await supabase.from('custom_rules').update({
        approval_status: 'approved',
        status: 'active',
        deployed: false
      }).eq('id', request.custom_rule_id)

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'rule_approved',
        target_type: 'custom_rule',
        target_id: request.custom_rule_id,
        target_name: request.rule_name,
        details: { client_name: request.clients?.name, rule_id: request.rule_id }
      })

      fetchRequests();
    } catch (err) {
      console.error('Approval failed:', err);
    }
  }

  const handleRejectRule = async () => {
    if (!rejectionReason) return;
    try {
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('rule_approval_requests').update({
        status: 'rejected',
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      }).eq('id', rejectingRequest.id)

      await supabase.from('custom_rules').update({
        approval_status: 'rejected',
        status: 'inactive',
        deployed: false
      }).eq('id', rejectingRequest.custom_rule_id)

      await supabase.from('admin_audit_log').insert({
        admin_email: user?.email,
        action: 'rule_rejected',
        target_type: 'custom_rule',
        target_id: rejectingRequest.custom_rule_id,
        target_name: rejectingRequest.rule_name,
        details: { rejection_reason: rejectionReason, client_name: rejectingRequest.clients?.name }
      })

      setRejectingRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err) {
      console.error('Rejection failed:', err);
    }
  }

  if (adminLoading) return <div className="flex-1 flex items-center justify-center bg-black"><Clock className="animate-spin text-neutral-500" /></div>;
  if (!isAdmin) return <div className="flex-1 flex items-center justify-center bg-black text-red-500 uppercase tracking-[0.3em] font-bold">Access Denied</div>;

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    deployed: requests.filter(r => r.status === 'deployed').length,
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-black text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Rule Approvals</h1>
          <p className="text-neutral-500 text-sm font-medium">Review and deploy custom rules across all clients.</p>
        </div>
        <button 
          onClick={fetchRequests}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-neutral-800"
        >
          <Clock className={cn("w-4 h-4 text-neutral-400", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: stats.pending, color: stats.pending > 0 ? 'text-red-500' : 'text-neutral-500' },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-500' },
          { label: 'Rejected', value: stats.rejected, color: 'text-neutral-500' },
          { label: 'Deployed', value: stats.deployed, color: 'text-blue-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.02] border border-neutral-800 rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{stat.label}</p>
            <h3 className={cn("text-2xl font-bold tracking-tighter", stat.color)}>{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-neutral-800 pb-px">
        {['all', 'pending', 'approved', 'rejected', 'deployed'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all relative",
              filter === t ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            {t}
            {filter === t && (
              <motion.div layoutId="approvalFilter" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.map((request) => (
          <div key={request.id} className='p-5 border border-neutral-800 rounded-xl bg-black hover:border-neutral-700 transition-all'>
            <div className='flex items-start justify-between mb-3'>
              <div>
                <div className='flex items-center gap-2 mb-1'>
                  <span className='text-[9px] font-bold text-neutral-500 uppercase tracking-widest'>
                    {request.clients?.name}
                  </span>
                  <span className='text-[9px] text-neutral-600'>·</span>
                  <span className='text-[9px] text-neutral-600 font-mono'>{request.clients?.wazuh_group}</span>
                </div>
                <h3 className='text-[13px] font-bold text-white'>{request.rule_name}</h3>
                <p className='text-[11px] text-neutral-500 mt-0.5'>{request.description}</p>
              </div>
              <div className='flex items-center gap-2 shrink-0 ml-4'>
                <RiskScoreBadge score={computeRiskScore(request).score} />
                <StatusBadge status={request.status} />
              </div>
            </div>

            <div className='grid grid-cols-3 gap-2 mb-3'>
              <div className='p-2 bg-neutral-900 rounded-lg'>
                <p className='text-[8px] text-neutral-600 uppercase tracking-widest'>Level</p>
                <p className='text-[11px] font-bold text-white'>{request.level} — {getLevelLabel(request.level)}</p>
              </div>
              <div className='p-2 bg-neutral-900 rounded-lg'>
                <p className='text-[8px] text-neutral-600 uppercase tracking-widest'>Pattern</p>
                <p className='text-[10px] font-mono text-neutral-300 truncate'>
                  {request.match_pattern || request.regex_pattern || 'None'}
                </p>
              </div>
              <div className='p-2 bg-neutral-900 rounded-lg'>
                <p className='text-[8px] text-neutral-600 uppercase tracking-widest'>Submitted</p>
                <p className='text-[10px] text-neutral-300'>{formatRelativeTime(request.submitted_at)}</p>
              </div>
            </div>

            {/* Risk flags */}
            {computeRiskScore(request).flags.length > 0 && (
              <div className='mb-3 space-y-1'>
                {computeRiskScore(request).flags.map((flag, i) => (
                  <div key={i} className='flex items-center gap-2 p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg'>
                    <AlertTriangle className='w-3 h-3 text-yellow-400 shrink-0' />
                    <p className='text-[10px] text-yellow-300'>{flag}</p>
                  </div>
                ))}
              </div>
            )}

            {request.status === 'pending' && (
              <div className='flex gap-2 pt-2'>
                <button
                  onClick={() => {/* Full details logic */}}
                  className='flex-1 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] font-bold text-neutral-400 hover:text-white hover:border-neutral-600 transition-all uppercase tracking-widest'
                >
                  Review Details
                </button>
                <button
                  onClick={() => handleQuickApprove(request)}
                  className='flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-white transition-all uppercase tracking-widest'
                >
                  Approve
                </button>
                <button
                  onClick={() => setRejectingRequest(request)}
                  className='flex-1 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-[10px] font-bold text-red-400 transition-all uppercase tracking-widest'
                >
                  Reject
                </button>
              </div>
            )}

            {request.status === 'approved' && (
              <div className="flex items-center gap-2 pt-2 text-[10px] text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Approved by {request.reviewed_by} · {formatRelativeTime(request.reviewed_at)}</span>
              </div>
            )}

            {request.status === 'rejected' && (
              <div className="flex items-center gap-2 pt-2 text-[10px] text-red-400">
                <X className="w-3.5 h-3.5" />
                <span>Rejected by {request.reviewed_by} · Reason: {request.rejection_reason}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold text-white mb-2">Reject Rule Request</h2>
              <p className="text-neutral-400 text-sm mb-6">Please provide a reason for rejecting the rule <strong>{rejectingRequest.rule_name}</strong>.</p>
              
              <textarea
                autoFocus
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full bg-black border border-neutral-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-6 min-h-[120px]"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setRejectingRequest(null)}
                  className="flex-1 py-3 text-xs font-bold text-neutral-400 hover:text-white transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectRule}
                  disabled={!rejectionReason}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-white transition-all uppercase tracking-widest"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RuleApprovalsPage;
