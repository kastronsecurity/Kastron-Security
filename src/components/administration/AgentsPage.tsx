
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Monitor, 
  Terminal, 
  Cpu, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ExternalLink,
  ChevronRight,
  Download,
  Copy,
  Check,
  AlertCircle,
  Trash2,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { cn } from '../../lib/utils';

interface Agent {
  id: string;
  name: string;
  ip: string;
  status: string;
  os: string;
  version: string;
  last_keepalive: string;
  wazuh_group: string;
}

export default function AgentsPage({ user }: { user: any }) {
  const { currentClient } = useClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingAgent, setIsAddingAgent] = useState(() => {
    const saved = sessionStorage.getItem('kastron_is_adding_agent');
    return saved === 'true';
  });

  useEffect(() => {
    sessionStorage.setItem('kastron_is_adding_agent', isAddingAgent.toString());
  }, [isAddingAgent]);

  const [showSecurityGate, setShowSecurityGate] = useState(false);
  const [securityStep, setSecurityStep] = useState<'password' | 'mfa'>('password');
  const [gatePassword, setGatePassword] = useState('');
  const [gateMfaCode, setGateMfaCode] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [uninstalledAgent, setUninstalledAgent] = useState<Agent | null>(null);
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

  useEffect(() => {
    fetchAgents();
    
    if (!supabase || !currentClient) return;

    const channel = supabase
      .channel('agents')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `client_id=eq.${currentClient.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setAgents(prev => prev.filter(a => a.id !== payload.old.id));
          } else if (payload.eventType === 'INSERT') {
            const newAgent = payload.new as Agent;
            setAgents(prev => {
              if (prev.some(a => a.id === newAgent.id)) return prev;
              return [...prev, newAgent];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedAgent = payload.new as Agent;
            setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClient]);

  const fetchAgents = async () => {
    if (!supabase || !currentClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!supabase || !deletingAgent || !currentClient) return;

    try {
      // Insert deletion request
      const { error } = await supabase
        .from('agent_deletions')
        .insert({
          agent_id: deletingAgent.id,
          agent_name: deletingAgent.name,
          client_id: currentClient.id,
          os: deletingAgent.os,
          status: 'pending'
        });

      if (error) throw error;

      // Remove agent from UI immediately
      setAgents(prev => prev.filter(a => a.id !== deletingAgent.id));
      
      // Prepare for uninstall modal
      setUninstalledAgent(deletingAgent);
      setDeletingAgent(null);
      setDeleteConfirmText('');
      setShowUninstallModal(true);
    } catch (error) {
      console.error('Error removing agent:', error);
      alert('Failed to remove agent. Please try again.');
    }
  };

  const handleStartAddAgent = () => {
    if (isAddingAgent) {
      setIsAddingAgent(false);
      return;
    }
    
    // Always require verification each time someone wants to view the keys
    setShowSecurityGate(true);
    setSecurityStep('password');
    setGatePassword('');
    setGateMfaCode('');
    setGateError(null);
  };

  const handleGatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    setGateLoading(true);
    setGateError(null);

    try {
      // Use signInWithPassword to verify current password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: gatePassword,
      });

      if (error) throw error;

      // Check if MFA is required for this new session
      const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
      if (mfaError) throw mfaError;

      const verifiedFactor = factors.all.find(f => f.status === 'verified');
      if (verifiedFactor) {
        setMfaFactorId(verifiedFactor.id);
        setSecurityStep('mfa');
      } else {
        // No MFA enabled, password was enough
        sessionStorage.setItem('manual_nav', 'true');
        sessionStorage.setItem('kastron_is_adding_agent', 'true');
        setTimeout(() => {
          setIsAddingAgent(true);
          setShowSecurityGate(false);
          setGatePassword('');
        }, 100);
      }
    } catch (err: any) {
      setGateError(err.message || 'Verification failed');
    } finally {
      setGateLoading(false);
    }
  };

  const handleGateMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !mfaFactorId) return;
    setGateLoading(true);
    setGateError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: gateMfaCode,
      });
      if (verifyError) throw verifyError;

      // Success!
      sessionStorage.setItem('manual_nav', 'true');
      sessionStorage.setItem('kastron_is_adding_agent', 'true');
      setTimeout(() => {
        setIsAddingAgent(true);
        setShowSecurityGate(false);
        setGateMfaCode('');
      }, 100);
    } catch (err: any) {
      setGateError(err.message || '2FA Verification failed');
    } finally {
      setGateLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.ip.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.os.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const disconnectedAgents = agents.filter(a => a.status !== 'active').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black p-8 overflow-y-auto scrollbar-hide">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Agent Management</h2>
            <p className="text-neutral-500">Monitor and deploy security agents across your infrastructure.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchAgents}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-[13px] font-bold hover:bg-neutral-800 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button 
              onClick={() => {
                if (isAddingAgent) {
                  setIsAddingAgent(false);
                } else {
                  handleStartAddAgent();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              {isAddingAgent ? (
                <>
                  <Monitor className="w-4 h-4" />
                  View Agents
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add New Agent
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {!isAddingAgent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total Agents</span>
              </div>
              <div className="text-3xl font-bold text-white">{agents.length}</div>
            </div>
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active</span>
              </div>
              <div className="text-3xl font-bold text-white">{activeAgents}</div>
            </div>
            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Disconnected</span>
              </div>
              <div className="text-3xl font-bold text-white">{disconnectedAgents}</div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isAddingAgent ? (
            <motion.div
              key="add-agent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-1">Deploy New Agent</h3>
                  <p className="text-neutral-500 text-sm">Follow the instructions below to secure a new endpoint.</p>
                </div>
                <button 
                  onClick={() => setIsAddingAgent(false)}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Linux */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-orange-500">
                    <Terminal className="w-5 h-5" />
                    <h4 className="font-bold">Linux Installation</h4>
                  </div>
                  <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-sm group relative">
                    <div className="flex items-center justify-between mb-2 text-neutral-500 text-xs">
                      <span>Run as Root</span>
                      <button 
                        onClick={() => copyToClipboard(`curl -s "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${currentClient?.install_key}&os=linux" | sudo bash`, 'linux')}
                        className="hover:text-white transition-colors"
                      >
                        {copiedKey === 'linux' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <code className="text-blue-400 break-all text-xs">
                      {`curl -s "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${currentClient?.install_key}&os=linux" | sudo bash`}
                    </code>
                  </div>
                </div>

                {/* Windows */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-500">
                    <Monitor className="w-5 h-5" />
                    <h4 className="font-bold">Windows Installation</h4>
                  </div>
                  <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-sm group relative">
                    <div className="flex items-center justify-between mb-2 text-neutral-500 text-xs">
                      <span>Run as Administrator</span>
                      <button 
                        onClick={() => copyToClipboard(`powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${currentClient?.install_key}&os=windows' -OutFile '$env:TEMP\\kastronsec-install.ps1'; & '$env:TEMP\\kastronsec-install.ps1'"` , 'windows')}
                        className="hover:text-white transition-colors"
                      >
                        {copiedKey === 'windows' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <code className="text-blue-400 break-all text-xs">
                      {`powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${currentClient?.install_key}&os=windows' -OutFile '$env:TEMP\\kastronsec-install.ps1'; & '$env:TEMP\\kastronsec-install.ps1'"`}
                    </code>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-4">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">Security Note</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    This installation key is unique to your organization. Do not share it publicly. 
                    The agent will automatically join the <span className="text-blue-400 font-bold">{currentClient?.wazuh_group}</span> group.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="agent-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Search & Filter */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search by name, IP, or OS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-neutral-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl overflow-hidden">
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
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-white/[0.02]">
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Agent Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">IP Address</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">OS / Version</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Last Keepalive</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                              <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Loading Agents...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredAgents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Monitor className="w-8 h-8 text-neutral-700" />
                              <div className="space-y-1">
                                <p className="text-sm text-white font-medium">No agents found</p>
                                <p className="text-xs text-neutral-500">Deploy your first agent to start monitoring.</p>
                              </div>
                              <button 
                                onClick={handleStartAddAgent}
                                className="mt-2 text-blue-500 text-xs font-bold hover:underline"
                              >
                                Deploy Agent Now
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredAgents.map((agent) => (
                          <tr key={agent.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  agent.status === 'active' ? "bg-green-500/10" : "bg-neutral-800"
                                )}>
                                  <Monitor className={cn("w-4 h-4", agent.status === 'active' ? "text-green-500" : "text-neutral-500")} />
                                </div>
                                <div>
                                  <div className="text-[13px] font-medium text-white">{agent.name}</div>
                                  <div className="text-[10px] text-neutral-500 font-mono">{agent.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter",
                                agent.status === 'active' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                              )}>
                                <div className={cn("w-1 h-1 rounded-full", agent.status === 'active' ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                                {agent.status}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[12px] font-mono text-neutral-300">{agent.ip}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-0.5">
                                <div className="text-[12px] text-white">{agent.os}</div>
                                <div className="text-[10px] text-neutral-500">Wazuh {agent.version}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-[12px] text-neutral-400">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(agent.last_keepalive).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 transition-all">
                                <button 
                                  onClick={async () => {
                                    const newStatus = agent.status === 'active' ? 'disconnected' : 'active';
                                    const { error } = await supabase
                                      .from('agents')
                                      .update({ status: newStatus })
                                      .eq('id', agent.id);
                                    if (error) console.error('Error toggling status:', error);
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg text-neutral-500 hover:text-blue-500 transition-all border border-neutral-800 hover:border-blue-500/20"
                                  title="Toggle Status (Test)"
                                >
                                  <Server className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Toggle</span>
                                </button>
                                <button 
                                  onClick={() => setDeletingAgent(agent)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 hover:bg-red-500/10 rounded-lg text-neutral-500 hover:text-red-500 transition-all border border-neutral-800 hover:border-red-500/20"
                                  title="Delete Agent"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Access Gate Modal */}
        <AnimatePresence>
          {showSecurityGate && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden"
              >
                {/* Decorative background identity check theme */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
                
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center rotate-3 border border-blue-500/20">
                    <Shield className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">Security Access Control</h3>
                    <p className="text-neutral-500 text-[13px] mt-2 leading-relaxed">
                      This action requires elevated permissions to view sensitive endpoint installation material.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {gateError && (
                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center gap-3 text-red-500 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p>{gateError}</p>
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {securityStep === 'password' ? (
                      <motion.form 
                        key="password-form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleGatePasswordSubmit}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Confirm Password</label>
                          <input 
                            type="password" 
                            required
                            autoFocus
                            placeholder="Enter your SOC password"
                            value={gatePassword}
                            onChange={(e) => setGatePassword(e.target.value)}
                            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-neutral-800 font-mono"
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={gateLoading || !gatePassword}
                          className="w-full py-4 bg-white text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                        >
                          {gateLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Continue to Verification'}
                        </button>
                      </motion.form>
                    ) : (
                      <motion.form 
                        key="mfa-form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={handleGateMfaSubmit}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">2FA Verification Code</label>
                          <input 
                            type="text" 
                            required
                            autoFocus
                            maxLength={6}
                            placeholder="000 000"
                            value={gateMfaCode}
                            onChange={(e) => setGateMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-neutral-800"
                          />
                        </div>
                        <button 
                          type="submit"
                          disabled={gateLoading || gateMfaCode.length !== 6}
                          className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-20 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                          {gateLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Authorize Access'}
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  <button 
                    type="button"
                    onClick={() => setShowSecurityGate(false)}
                    className="w-full py-2 text-neutral-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Cancel Action
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deletingAgent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Remove Agent</h3>
                    <p className="text-neutral-500 text-sm mt-1">
                      This will permanently remove <span className="text-white font-bold">{deletingAgent.name}</span> from KastronSec monitoring.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Confirmation</label>
                    <input 
                      type="text" 
                      placeholder="Type DELETE to confirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-700 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setDeletingAgent(null);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDeleteAgent}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20"
                    >
                      Remove Agent
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Uninstall Instructions Modal */}
        <AnimatePresence>
          {showUninstallModal && uninstalledAgent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Agent Removal Initiated</h3>
                      <p className="text-neutral-500 text-xs">Agent {uninstalledAgent.name} is being removed.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowUninstallModal(false)}
                    className="text-neutral-500 hover:text-white transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Agent <span className="text-white font-bold">{uninstalledAgent.name}</span> is being removed from KastronSec. This may take up to 30 seconds to complete. To completely remove the agent software from the machine, run this command on that device:
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-500">
                      {uninstalledAgent.os.toLowerCase().includes('windows') ? (
                        <>
                          <Monitor className="w-5 h-5" />
                          <h4 className="font-bold">Run in PowerShell as Administrator</h4>
                        </>
                      ) : (
                        <>
                          <Terminal className="w-5 h-5 text-orange-500" />
                          <h4 className="font-bold text-orange-500">Run in Terminal as root</h4>
                        </>
                      )}
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-sm group relative">
                      <div className="flex items-center justify-between mb-2 text-neutral-500 text-xs">
                        <span>{uninstalledAgent.os.toLowerCase().includes('windows') ? 'POWERSHELL' : 'BASH'}</span>
                        <button 
                          onClick={() => {
                            const cmd = uninstalledAgent.os.toLowerCase().includes('windows')
                              ? 'NET STOP WazuhSvc; Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like \'*wazuh*\' } | ForEach-Object { $_.Uninstall() }'
                              : 'sudo systemctl stop wazuh-agent && sudo apt-get remove wazuh-agent -y && sudo rm -rf /var/ossec';
                            copyToClipboard(cmd, 'uninstall');
                          }}
                          className="hover:text-white transition-colors"
                        >
                          {copiedKey === 'uninstall' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <code className="text-blue-400 break-all text-xs">
                        {uninstalledAgent.os.toLowerCase().includes('windows') 
                          ? 'NET STOP WazuhSvc; Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like \'*wazuh*\' } | ForEach-Object { $_.Uninstall() }'
                          : 'sudo systemctl stop wazuh-agent && sudo apt-get remove wazuh-agent -y && sudo rm -rf /var/ossec'}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setShowUninstallModal(false)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xl"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
