import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  HelpCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  X,
  Code,
  Search,
  Terminal,
  Shield,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { cn, getSeverityFromLevel } from '../../lib/utils';
import { SeverityBadge } from '../ui/StatusElements';

interface CustomRule {
  id: string;
  client_id: string;
  rule_id: number;
  name: string;
  description: string;
  level: number;
  match_pattern: string | null;
  regex_pattern: string | null;
  log_source: string;
  mitre_id: string | null;
  mitre_tactic: string | null;
  mitre_technique: string | null;
  status: string;
  deployed: boolean;
  approval_status?: string;
  created_at: string;
  updated_at: string;
}

const RULE_TEMPLATES = [
  { name: 'Failed SSH login', match: 'failed password', level: 5, log_source: 'syslog', description: 'Detects failed SSH login attempts' },
  { name: 'Web scanner detected', match: 'nikto', level: 7, log_source: 'apache', description: 'Detects Nikto web scanner activity' },
  { name: 'SQL injection attempt', match: 'union select', level: 10, log_source: 'apache', description: 'Detects common SQL injection patterns' },
  { name: 'Suspicious file access', match: '/etc/passwd', level: 8, log_source: 'syslog', description: 'Detects access attempts to sensitive system files' },
  { name: 'Malware download attempt', match: 'wget', level: 10, log_source: 'syslog', description: 'Detects use of wget for potential malware downloads' },
];

const LOG_SOURCES = ['syslog', 'apache', 'nginx', 'windows', 'journald'];

export default function CustomRulesPage() {
  const { currentClient } = useClient();
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isXmlPreviewOpen, setIsXmlPreviewOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CustomRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: 5,
    match_pattern: '',
    regex_pattern: '',
    log_source: 'syslog',
    mitre_id: '',
    mitre_tactic: '',
    mitre_technique: ''
  });

  const fetchRules = async () => {
    if (!currentClient) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_rules')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();

    if (currentClient) {
      const subscription = supabase
        .channel('custom_rules_changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'custom_rules',
            filter: `client_id=eq.${currentClient.id}`
          },
          () => {
            fetchRules();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [currentClient]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;

    if (!formData.match_pattern && !formData.regex_pattern) {
      alert('At least one of Match Pattern or Regex Pattern must be filled.');
      return;
    }

    try {
      if (selectedRule) {
        // Update existing rule - trigger new approval request
        const { data: updatedRule, error: updateError } = await supabase
          .from('custom_rules')
          .update({
            name: formData.name,
            description: formData.description,
            level: formData.level,
            match_pattern: formData.match_pattern || null,
            regex_pattern: formData.regex_pattern || null,
            log_source: formData.log_source,
            mitre_id: formData.mitre_id || null,
            mitre_tactic: formData.mitre_tactic || null,
            mitre_technique: formData.mitre_technique || null,
            deployed: false,
            approval_status: 'pending',
            status: 'inactive', // Inactive while pending
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRule.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Create approval request for updated rule
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('rule_approval_requests').insert({
          client_id: currentClient.id,
          custom_rule_id: selectedRule.id,
          rule_id: selectedRule.rule_id,
          rule_name: formData.name,
          description: formData.description,
          level: formData.level,
          match_pattern: formData.match_pattern || null,
          regex_pattern: formData.regex_pattern || null,
          log_source: formData.log_source,
          mitre_id: formData.mitre_id || null,
          mitre_tactic: formData.mitre_tactic || null,
          mitre_technique: formData.mitre_technique || null,
          status: 'pending',
          submitted_by: user?.email
        });
      } else {
        // Create new rule
        const { data: existingRules, error: fetchError } = await supabase
          .from('custom_rules')
          .select('rule_id')
          .order('rule_id', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const baseRuleId = 200000;
        const lastRuleId = existingRules?.[0]?.rule_id ?? baseRuleId;
        const nextRuleId = lastRuleId + 1;

        const { data: newRule, error: insertError } = await supabase
          .from('custom_rules')
          .insert({
            client_id: currentClient.id,
            rule_id: nextRuleId,
            name: formData.name,
            description: formData.description,
            level: formData.level,
            match_pattern: formData.match_pattern || null,
            regex_pattern: formData.regex_pattern || null,
            log_source: formData.log_source,
            mitre_id: formData.mitre_id || null,
            mitre_tactic: formData.mitre_tactic || null,
            mitre_technique: formData.mitre_technique || null,
            status: 'inactive',
            deployed: false,
            approval_status: 'pending'
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Create approval request for new rule
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('rule_approval_requests').insert({
          client_id: currentClient.id,
          custom_rule_id: newRule.id,
          rule_id: nextRuleId,
          rule_name: formData.name,
          description: formData.description,
          level: formData.level,
          match_pattern: formData.match_pattern || null,
          regex_pattern: formData.regex_pattern || null,
          log_source: formData.log_source,
          mitre_id: formData.mitre_id || null,
          mitre_tactic: formData.mitre_tactic || null,
          mitre_technique: formData.mitre_technique || null,
          status: 'pending',
          submitted_by: user?.email
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      console.error('Error saving rule:', error);
      const errorMsg = error.message || error.details || error.hint || (typeof error === 'string' ? error : JSON.stringify(error));
      alert(`Failed to save rule: ${errorMsg}`);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('custom_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      level: 5,
      match_pattern: '',
      regex_pattern: '',
      log_source: 'syslog',
      mitre_id: '',
      mitre_tactic: '',
      mitre_technique: ''
    });
    setSelectedRule(null);
  };

  const openEditModal = (rule: CustomRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      level: rule.level,
      match_pattern: rule.match_pattern || '',
      regex_pattern: rule.regex_pattern || '',
      log_source: rule.log_source,
      mitre_id: rule.mitre_id || '',
      mitre_tactic: rule.mitre_tactic || '',
      mitre_technique: rule.mitre_technique || ''
    });
    setIsModalOpen(true);
  };

  const applyTemplate = (template: typeof RULE_TEMPLATES[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      match_pattern: template.match,
      level: template.level,
      log_source: template.log_source
    });
  };

  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.rule_id.toString().includes(searchQuery)
  );

  const generateXml = (rule: CustomRule) => {
    return `<group name='kastronsec_custom,'>
  <rule id='${rule.rule_id}' level='${rule.level}'>
    ${rule.match_pattern ? `<match>${rule.match_pattern}</match>` : ''}
    ${rule.regex_pattern ? `<regex>${rule.regex_pattern}</regex>` : ''}
    <description>Custom: ${rule.name}</description>
    ${rule.mitre_id ? `<mitre>
      <id>${rule.mitre_id}</id>
    </mitre>` : ''}
  </rule>
</group>`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Custom Detection Rules</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Define and deploy custom Wazuh rules to your agent groups
          </p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-4 py-2 bg-blue-600 rounded-md text-[12px] font-medium text-white hover:bg-blue-500 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Rule
        </button>
      </div>

      {/* Section 1: Rule List Table */}
      <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 bg-white/[0.01]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={cn(
            "overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing",
            isDragging && "select-none"
          )}
        >
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="text-neutral-500 border-b border-neutral-800 bg-white/[0.01] uppercase tracking-widest font-bold text-[10px]">
                <th className="px-6 py-4">Rule ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Level</th>
                <th className="px-6 py-4">Log Source</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-neutral-500">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span>Loading rules...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-neutral-500">
                    No custom rules found.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-mono text-blue-400">{rule.rule_id}</td>
                    <td className="px-6 py-4 font-medium text-white">{rule.name}</td>
                    <td className="px-6 py-4 text-neutral-400 max-w-xs truncate">{rule.description}</td>
                    <td className="px-6 py-4">
                      <SeverityBadge severity={getSeverityFromLevel(rule.level)} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded text-[9px] font-bold uppercase">
                        {rule.log_source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rule.approval_status === 'rejected' ? (
                        <div className="flex items-center gap-1.5 text-red-500 cursor-help" title="Rule rejected by admin. Review and edit to re-submit.">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Rejected</span>
                        </div>
                      ) : rule.approval_status === 'pending' ? (
                        <div className="flex items-center gap-1.5 text-yellow-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Review</span>
                        </div>
                      ) : rule.deployed ? (
                        <div className="flex items-center gap-1.5 text-green-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Live</span>
                        </div>
                      ) : rule.approval_status === 'approved' ? (
                        <div className="flex items-center gap-1.5 text-blue-500">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[10px] font-bold uppercase">Deploying</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-orange-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase">Pending</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {new Date(rule.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedRule(rule); setIsXmlPreviewOpen(true); }}
                          className="p-1.5 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
                          title="Preview XML"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-colors"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded text-neutral-400 hover:text-red-500 transition-colors"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Rule Templates */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Quick Templates</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {RULE_TEMPLATES.map((template) => (
            <button
              key={template.name}
              onClick={() => {
                resetForm();
                applyTemplate(template);
                setIsModalOpen(true);
              }}
              className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
            >
              <h4 className="text-[11px] font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{template.name}</h4>
              <p className="text-[10px] text-neutral-500 line-clamp-2">{template.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[9px] font-bold text-neutral-600 uppercase">{template.log_source}</span>
                <Plus className="w-3 h-3 text-neutral-600 group-hover:text-blue-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 5: Help Panel */}
      <div className="bg-blue-600/5 border border-blue-500/20 rounded-xl p-6 flex gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center flex-shrink-0">
          <Info className="w-5 h-5 text-blue-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">How Custom Rules Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Rules are automatically deployed to your agents within 30 seconds.
            </p>
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Match Pattern: a keyword that must appear in the log line.
            </p>
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Regex Pattern: a regular expression for complex pattern matching.
            </p>
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              At least one of Match Pattern or Regex Pattern is required.
            </p>
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Rule IDs start from 200000 and increment automatically.
            </p>
            <p className="text-[11px] text-neutral-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Changes to existing rules will be redeployed automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                    <Code className="w-4 h-4 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{selectedRule ? 'Edit Rule' : 'Create New Rule'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRule} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Rule Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Failed SSH Login"
                      className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Log Source</label>
                    <select 
                      value={formData.log_source}
                      onChange={(e) => setFormData({ ...formData, log_source: e.target.value })}
                      className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      {LOG_SOURCES.map(src => (
                        <option key={src} value={src}>{src.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Description</label>
                  <input 
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Briefly describe what this rule detects"
                    className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Severity Level (1-15)</label>
                    <div className="flex items-center gap-4">
                      <select 
                        value={formData.level}
                        onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                        className="flex-1 bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        {Array.from({ length: 15 }, (_, i) => i + 1).map(lv => (
                          <option key={lv} value={lv}>Level {lv}</option>
                        ))}
                      </select>
                      <SeverityBadge severity={getSeverityFromLevel(formData.level)} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Match Pattern</label>
                    <input 
                      type="text"
                      value={formData.match_pattern}
                      onChange={(e) => setFormData({ ...formData, match_pattern: e.target.value })}
                      placeholder="e.g. failed password"
                      className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-[9px] text-neutral-500">Keyword that must appear in log</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Regex Pattern</label>
                    <input 
                      type="text"
                      value={formData.regex_pattern}
                      onChange={(e) => setFormData({ ...formData, regex_pattern: e.target.value })}
                      placeholder="e.g. \b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b"
                      className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-[9px] text-neutral-500">Regular expression for complex patterns</p>
                  </div>
                </div>

                <div className="p-4 bg-black/50 border border-neutral-800 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">MITRE ATT&CK (Optional)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">ID</label>
                      <input 
                        type="text"
                        value={formData.mitre_id}
                        onChange={(e) => setFormData({ ...formData, mitre_id: e.target.value })}
                        placeholder="T1110.001"
                        className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">Tactic</label>
                      <input 
                        type="text"
                        value={formData.mitre_tactic}
                        onChange={(e) => setFormData({ ...formData, mitre_tactic: e.target.value })}
                        placeholder="Credential Access"
                        className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-600 uppercase">Technique</label>
                      <input 
                        type="text"
                        value={formData.mitre_technique}
                        onChange={(e) => setFormData({ ...formData, mitre_technique: e.target.value })}
                        placeholder="Password Guessing"
                        className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-[12px] font-medium text-neutral-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-blue-600 rounded-lg text-[12px] font-bold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                  >
                    {selectedRule ? 'Update Rule' : 'Save Rule'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Section 4: XML Preview Modal */}
      <AnimatePresence>
        {isXmlPreviewOpen && selectedRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsXmlPreviewOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <Terminal className="w-4 h-4 text-blue-500" />
                  <h3 className="text-lg font-bold text-white">Wazuh XML Preview</h3>
                </div>
                <button onClick={() => setIsXmlPreviewOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="bg-black rounded-xl p-4 font-mono text-[11px] text-neutral-300 overflow-x-auto border border-neutral-800">
                  <pre>{generateXml(selectedRule)}</pre>
                </div>
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => setIsXmlPreviewOpen(false)}
                    className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-[12px] font-bold text-white transition-colors"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
