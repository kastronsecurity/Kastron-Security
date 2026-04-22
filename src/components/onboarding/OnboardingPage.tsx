import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Terminal, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Shield, 
  Monitor, 
  Cpu, 
  Server,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Lock,
  LogOut,
  Globe,
  Settings,
  Cloud,
  Copy,
  Clock,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface OnboardingPageProps {
  user: any;
  onComplete: () => void;
}

const WAZUH_IP = import.meta.env.VITE_WAZUH_IP || 'your-wazuh-server-ip';

const OnboardingPage: React.FC<OnboardingPageProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installKey, setInstallKey] = useState<string | null>(null);
  const [wazuhGroup, setWazuhGroup] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [client, setClient] = useState<any>(null);

  // Wizard state
  const [selections, setSelections] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [firewallConfig, setFirewallConfig] = useState({
    brand: '',
    name: '',
    ip: '',
    port: 514,
    protocol: 'UDP' as 'UDP' | 'TCP'
  });
  const [agents, setAgents] = useState<any[]>([]);
  const [firewallStatus, setFirewallStatus] = useState<'none' | 'pending' | 'received'>('none');
  const [skipped, setSkipped] = useState(false);
  const [firewallTab, setFirewallTab] = useState<'config' | 'details'>('config');

  const fetchClientData = async () => {
    if (!supabase || !user) return;
    setLoadingKey(true);
    setError(null);
    
    // Check user metadata first for a consistent key
    const metaInstallKey = user.user_metadata?.install_key;
    const metaWazuhGroup = user.user_metadata?.wazuh_group;
    
    if (metaInstallKey) {
      setInstallKey(metaInstallKey);
      setWazuhGroup(metaWazuhGroup);
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setClient(data);
        setInstallKey(data.install_key);
        setWazuhGroup(data.wazuh_group);
        
        // Restore step if needed
        if (data.onboarding_step) {
          setStep(data.onboarding_step);
        }

        // Restore selections
        if (data.infrastructure) {
          const infra = data.infrastructure;
          const newSelections = [];
          if (infra.has_windows) newSelections.push('windows');
          if (infra.has_linux) newSelections.push('linux');
          if (infra.has_firewall) newSelections.push('firewall');
          if (infra.has_webserver) newSelections.push('webserver');
          if (infra.has_cloud) newSelections.push('cloud');
          if (infra.has_custom) newSelections.push('custom');
          setSelections(newSelections);

          if (infra.has_firewall) {
            setFirewallConfig(prev => ({
              ...prev,
              brand: infra.firewall_type || '',
              ip: infra.firewall_ip || '',
              port: infra.syslog_port || 514,
              protocol: infra.syslog_protocol || 'UDP'
            }));
          }
        }

        // No record found — create one for this user
        console.log('No client record found, creating one...');
        
        // Use existing metadata key if available, otherwise generate new one
        const finalInstallKey = metaInstallKey || crypto.randomUUID();
        const companyName = user.user_metadata?.company_name || 'KastronSec Client';
        const finalWazuhGroup = metaWazuhGroup || ('G-' + companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));

        // Update metadata immediately so it persists even if DB insert fails
        if (!metaInstallKey) {
          await supabase.auth.updateUser({
            data: { 
              install_key: finalInstallKey, 
              wazuh_group: finalWazuhGroup 
            }
          });
        }

        // Call Edge Function to create/update client record (bypasses RLS)
        const { data: newClient, error: insertError } = await supabase.functions.invoke('create-client', {
          body: {
            name: companyName,
            install_key: finalInstallKey,
            wazuh_group: finalWazuhGroup
          }
        });
        
        if (!insertError && newClient) {
          setInstallKey(newClient.install_key);
          setWazuhGroup(newClient.wazuh_group);
        } else if (insertError) {
          console.error('Insert error (via Edge Function):', insertError);
          // We still set the local state from metadata so the user sees a consistent key
          setInstallKey(finalInstallKey);
          setWazuhGroup(finalWazuhGroup);
        }
      } else if (error) {
        console.error('Fetch error:', error);
        if (!metaInstallKey) {
          setError(`Database error: ${error.message}`);
        }
      }
    } catch (err: any) {
      console.error('Error fetching client data:', err);
      if (!metaInstallKey) {
        setError(`Unexpected error: ${err.message}`);
      }
    } finally {
      setLoadingKey(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [user]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const installers = [
    { name: 'Windows', icon: Monitor, version: 'v2.4.1', size: '42MB', color: 'text-blue-500' },
    { name: 'Linux', icon: Terminal, version: 'v2.4.1', size: '28MB', color: 'text-orange-500' },
    { name: 'macOS', icon: Cpu, version: 'v2.4.1', size: '35MB', color: 'text-neutral-400' }
  ];

  const handleStep1Next = async () => {
    if (selections.length === 0 || !supabase || !client) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          infrastructure: {
            has_windows: selections.includes('windows'),
            has_linux: selections.includes('linux'),
            has_firewall: selections.includes('firewall'),
            has_webserver: selections.includes('webserver'),
            has_cloud: selections.includes('cloud'),
            has_custom: selections.includes('custom')
          },
          onboarding_step: selections.includes('firewall') ? 2 : 3
        })
        .eq('id', client.id);

      if (error) throw error;
      setStep(selections.includes('firewall') ? 2 : 3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStep2Save = async () => {
    if (!supabase || !client) return;
    if (!firewallConfig.brand || !firewallConfig.name || !firewallConfig.ip) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update client
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          infrastructure: {
            ...client.infrastructure,
            has_firewall: true,
            firewall_type: firewallConfig.brand,
            firewall_ip: firewallConfig.ip,
            syslog_port: firewallConfig.port,
            syslog_protocol: firewallConfig.protocol
          },
          onboarding_step: 3
        })
        .eq('id', client.id);

      if (clientError) throw clientError;

      // 2. Insert syslog source
      const { error: syslogError } = await supabase
        .from('syslog_sources')
        .insert({
          client_id: client.id,
          name: firewallConfig.name,
          source_type: 'firewall',
          brand: firewallConfig.brand,
          source_ip: firewallConfig.ip,
          syslog_port: firewallConfig.port,
          syslog_protocol: firewallConfig.protocol,
          status: 'pending'
        });

      if (syslogError) throw syslogError;
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!supabase || !user) return;
    setVerifying(true);
    try {
      await supabase.from('clients').update({ onboarding_step: 5 }).eq('user_id', user.id);
      
      const { error: updateError } = await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });

      if (updateError) throw updateError;
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (step === 4 && supabase && client) {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('agents')
          .select('*')
          .eq('client_id', client.id);
        if (data) setAgents(data);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step, client]);

  const toggleSelection = (id: string) => {
    if (id === 'cloud') return; // Disabled
    setSelections(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const showToast = (msg: string) => {
    // Simple copy feedback
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2 rounded-full font-bold text-xs tracking-widest uppercase z-[100] animate-in fade-in slide-in-from-bottom-2';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Hero Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-400 transition-all text-[11px] font-bold uppercase tracking-widest group px-4 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/20"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Back to Login
          </button>

          <div className="flex items-center gap-6">
            {user.user_metadata?.onboarding_completed && (
              <button 
                onClick={onComplete}
                className="flex items-center gap-2 text-neutral-500 hover:text-white transition-all text-[11px] font-bold uppercase tracking-widest group px-3 py-1.5 rounded-full hover:bg-white/5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-neutral-500 hover:text-white transition-all text-[11px] font-bold uppercase tracking-widest group px-3 py-1.5 rounded-full hover:bg-white/5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-16 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-8">
            <Lock className="w-3 h-3 text-blue-500" />
            Secure Onboarding
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tighter leading-tight">
            Welcome to KastronSec
          </h1>
          <p className="text-neutral-500 text-lg max-w-lg mx-auto font-medium leading-relaxed">
            Let's get your infrastructure secured. Follow these simple steps to deploy your first agent.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-16 px-8 relative">
          <div className="absolute top-1/2 left-8 right-8 h-px bg-white/5 -translate-y-1/2 z-0" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all duration-500 border text-xs",
                step >= i 
                  ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
                  : "bg-black border-white/10 text-neutral-600"
              )}>
                {step > i ? <CheckCircle2 className="w-4 h-4" /> : i}
              </div>
            </div>
          ))}
        </div>

        {/* Steps Content */}
        <div className="bg-black border border-white/10 rounded-2xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-white/50 to-red-500/50 opacity-20" />
          
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">What do you want to monitor?</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">Select all that apply to your environment</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { id: 'windows', name: 'Windows Endpoints', icon: Monitor, desc: 'Windows workstations and servers' },
                    { id: 'linux', name: 'Linux Servers', icon: Terminal, desc: 'Linux/Ubuntu/CentOS servers' },
                    { id: 'firewall', name: 'Network Firewall', icon: Shield, desc: 'pfSense, FortiGate, Cisco ASA, etc' },
                    { id: 'webserver', name: 'Web Servers', icon: Globe, desc: 'Apache, Nginx web servers' },
                    { id: 'cloud', name: 'Cloud Infrastructure', icon: Cloud, desc: 'AWS, Azure, GCP logs', badge: 'Coming Soon' },
                    { id: 'custom', name: 'Other / Custom', icon: Settings, desc: 'Any syslog-compatible device' }
                  ].map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => toggleSelection(item.id)}
                      disabled={!!item.badge}
                      className={cn(
                        "group p-6 rounded-xl border transition-all text-left relative",
                        selections.includes(item.id)
                          ? "border-red-500/60 bg-red-500/10"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]",
                        item.badge && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {item.badge && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-white/10 text-[8px] font-bold uppercase tracking-widest text-neutral-400">
                          {item.badge}
                        </span>
                      )}
                      <item.icon className={cn(
                        "w-6 h-6 mb-4 transition-transform group-hover:scale-110",
                        selections.includes(item.id) ? "text-red-500" : "text-neutral-400"
                      )} />
                      <h3 className="font-bold text-sm mb-1 tracking-tight">{item.name}</h3>
                      <p className="text-[10px] text-neutral-500 font-medium leading-tight">{item.desc}</p>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pt-6 border-t border-white/5">
                  <button 
                    onClick={handleStep1Next}
                    disabled={selections.length === 0 || isSaving}
                    className="bg-white text-black px-8 py-3 rounded-md font-bold text-[13px] transition-all flex items-center gap-2 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Next Step'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">Configure Firewall Log Forwarding</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">We need a few details to receive logs from your firewall</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Firewall Brand *</label>
                      <div className="relative">
                        <select 
                          value={firewallConfig.brand}
                          onChange={(e) => setFirewallConfig(prev => ({ ...prev, brand: e.target.value }))}
                          className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white/20 appearance-none text-white transition-all cursor-pointer"
                        >
                          <option value="" className="bg-black text-white">Select Brand</option>
                          <option value="pfSense" className="bg-black text-white">pfSense</option>
                          <option value="OPNsense" className="bg-black text-white">OPNsense</option>
                          <option value="FortiGate" className="bg-black text-white">FortiGate</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Firewall Name *</label>
                      <input 
                        type="text"
                        placeholder="Give it a friendly name"
                        value={firewallConfig.name}
                        onChange={(e) => setFirewallConfig(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Firewall IP Address *</label>
                      <input 
                        type="text"
                        placeholder="192.168.1.1"
                        value={firewallConfig.ip}
                        onChange={(e) => setFirewallConfig(prev => ({ ...prev, ip: e.target.value }))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500/50"
                      />
                      <p className="text-[10px] text-neutral-600 italic">The LAN IP of your firewall</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Syslog Port</label>
                      <input 
                        type="number"
                        value={firewallConfig.port}
                        onChange={(e) => setFirewallConfig(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-red-500/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Protocol</label>
                      <div className="flex bg-white/[0.03] border border-white/10 rounded-lg p-1">
                        {['UDP', 'TCP'].map((p) => (
                          <button
                            key={p}
                            onClick={() => setFirewallConfig(prev => ({ ...prev, protocol: p as 'UDP' | 'TCP' }))}
                            className={cn(
                              "flex-1 py-2 text-xs font-bold rounded-md transition-all",
                              firewallConfig.protocol === p ? "bg-white text-black" : "text-neutral-500"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-red-500 text-[11px] flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-white/5">
                  <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">Back</button>
                  <button 
                    onClick={handleStep2Save}
                    disabled={isSaving}
                    className="bg-white text-black px-8 py-3 rounded-md font-bold text-[13px] transition-all flex items-center gap-2 hover:bg-neutral-200"
                  >
                    {isSaving ? 'Configuring...' : 'Continue'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">Install Security Agents</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">Execute the following commands to secure your infrastructure</p>
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
                  {selections.includes('windows') && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-blue-500">
                        <Monitor className="w-4 h-4" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest">Windows Agent Installation</h3>
                      </div>
                      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 font-mono text-[12px] text-green-400 group relative">
                        <button 
                          onClick={() => copyToClipboard(`powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=windows' -OutFile '$env:TEMP\\kastronsec-install.ps1'; & '$env:TEMP\\kastronsec-install.ps1'"`)}
                          className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                        >
                          <Copy className="w-4 h-4 text-white" />
                        </button>
                        <code>
                          powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '{import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key={installKey}&os=windows' -OutFile '$env:TEMP\kastronsec-install.ps1'; & '$env:TEMP\kastronsec-install.ps1'"
                        </code>
                      </div>
                    </div>
                  )}

                  {selections.includes('linux') && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-orange-500">
                        <Terminal className="w-4 h-4" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest">Linux Agent Installation</h3>
                      </div>
                      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 font-mono text-[12px] text-green-400 group relative">
                        <button 
                          onClick={() => copyToClipboard(`curl -s "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=linux" | sudo bash`)}
                          className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                        >
                          <Copy className="w-4 h-4 text-white" />
                        </button>
                        <code>
                          curl -s "{import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key={installKey}&os=linux" | sudo bash
                        </code>
                      </div>
                    </div>
                  )}

                  {selections.includes('firewall') && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-red-500">
                        <Shield className="w-4 h-4" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest">Firewall Log Forwarding Setup</h3>
                      </div>
                      <p className="text-[11px] text-neutral-500 font-medium">Configure your {firewallConfig.brand} to send logs to KastronSec</p>
                      
                      <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                        <div className="flex border-b border-white/5">
                          <button 
                            onClick={() => setFirewallTab('config')}
                            className={cn(
                              "px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors",
                              firewallTab === 'config' ? "bg-white/5 text-white" : "text-neutral-500 hover:text-white"
                            )}
                          >
                            Configuration Steps
                          </button>
                          <button 
                            onClick={() => setFirewallTab('details')}
                            className={cn(
                              "px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors",
                              firewallTab === 'details' ? "bg-white/5 text-white" : "text-neutral-500 hover:text-white"
                            )}
                          >
                            Connection Details
                          </button>
                        </div>
                        <div className="p-6">
                          {firewallTab === 'config' ? (
                            <div className="space-y-4 text-[13px] text-neutral-400 font-medium leading-relaxed">
                              {firewallConfig.brand === 'pfSense' && (
                                <ol className="list-decimal list-inside space-y-2">
                                  <li>Access your <b>pfSense Dashboard</b> and then navigate to <b>Status &gt; System Logs &gt; Settings</b></li>
                                  <li>Scroll to <b>Remote Logging Options</b> and enable <b>Send log messages to remote syslog server</b></li>
                                  <li>Under <b>Remote Syslog Contents</b>, check <b>Everything</b></li>
                                  <li>In <b>Remote Syslog Servers</b>, enter <code>{WAZUH_IP}:514</code> and click <b>Save</b></li>
                                </ol>
                              )}
                              {firewallConfig.brand === 'FortiGate' && (
                                <ol className="list-decimal list-inside space-y-2">
                                  <li>Log in to your <b>FortiGate Dashboard</b> and go to <b>Log & Report &gt; Log Settings</b></li>
                                  <li>Enable <b>Send Logs to Syslog</b> and enter IP: <code>{WAZUH_IP}</code></li>
                                  <li>Set Port to <code>514</code> and Protocol to <b>UDP</b></li>
                                  <li>Click <b>Apply</b> to save the settings</li>
                                </ol>
                              )}
                              {firewallConfig.brand === 'OPNsense' && (
                                <ol className="list-decimal list-inside space-y-2">
                                  <li>Access your <b>OPNsense Dashboard</b> and navigate to <b>System &gt; Logging &gt; Targets</b></li>
                                  <li>Click <b>+ (Plus)</b> to add a new target, set Transport to <b>UDP (4)</b></li>
                                  <li>Set Hostname to <code>{WAZUH_IP}</code> and Port to <code>514</code></li>
                                  <li>Select log types to forward, then <b>Save</b> and <b>Apply Changes</b></li>
                                </ol>
                              )}
                              {(!['pfSense', 'FortiGate', 'OPNsense'].includes(firewallConfig.brand)) && (
                                <p>Access your firewall's dashboard at <code className="text-blue-400">https://{firewallConfig.ip}</code>, navigate to the Syslog/Remote Logging settings and point it to: <br/><code className="text-red-400">{WAZUH_IP}:514</code> via {firewallConfig.protocol}</p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">KastronSec Syslog IP</span>
                                  <div className="flex items-center justify-between bg-black rounded p-3 border border-white/5 group relative">
                                    <span className="text-xs font-mono text-green-400">{WAZUH_IP}</span>
                                    <button 
                                      onClick={() => copyToClipboard(WAZUH_IP)}
                                      className="p-1 px-2 rounded bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-white uppercase"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Syslog Port</span>
                                  <div className="flex items-center justify-between bg-black rounded p-3 border border-white/5">
                                    <span className="text-xs font-mono text-blue-400">514</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Protocol</span>
                                  <div className="flex items-center justify-between bg-black rounded p-3 border border-white/5">
                                    <span className="text-xs font-mono text-neutral-400">{firewallConfig.protocol}</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Your Firewall IP</span>
                                  <div className="flex items-center justify-between bg-black rounded p-3 border border-white/5">
                                    <span className="text-xs font-mono text-blue-400">{firewallConfig.ip}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-blue-400">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Security Note</span>
                                </div>
                                <p className="text-[11px] text-neutral-500 leading-relaxed">
                                  Ensure your firewall allows outgoing traffic on port <b>514 ({firewallConfig.protocol})</b> to the KastronSec Syslog IP.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selections.includes('webserver') && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <Globe className="w-4 h-4" />
                        <h3 className="text-[11px] font-bold uppercase tracking-widest">Web Server Log Monitoring</h3>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Step 1: Installation */}
                        <div className="space-y-2">
                          <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-widest">Step 1: Install Security Agent</p>
                          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">First, install the security agent on your web server:</p>
                          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4 font-mono text-[12px] text-green-400 group relative">
                            <button 
                              onClick={() => copyToClipboard(`curl -s "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=linux" | sudo bash`)}
                              className="absolute right-4 top-4 p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                            >
                              <Copy className="w-4 h-4 text-white" />
                            </button>
                            <code>
                              curl -s "{import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key={installKey}&os=linux" | sudo bash
                            </code>
                          </div>
                        </div>

                        {/* Step 2: Configuration */}
                        <div className="space-y-4">
                          <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-widest">Step 2: Configure Log Collection</p>
                          
                          <div className="space-y-3">
                            <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">1. Open the configuration file:</p>
                            <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-green-400 group relative">
                              <button onClick={() => copyToClipboard('sudo nano /var/ossec/etc/ossec.conf')} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3.5 h-3.5 text-white" /></button>
                              <code>sudo nano /var/ossec/etc/ossec.conf</code>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">2. Scroll to the bottom and paste the following block based on your web server:</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Apache (Ubuntu/Debian)</span>
                                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-emerald-400 group relative">
                                  <button onClick={() => copyToClipboard(`<localfile>\n  <log_format>apache</log_format>\n  <location>/var/log/apache2/access.log</location>\n</localfile>`)} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3.5 h-3.5 text-white" /></button>
                                  <pre className="text-[10px]">
{`<localfile>
  <log_format>apache</log_format>
  <location>/var/log/apache2/access.log</location>
</localfile>`}
                                  </pre>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Nginx (Universal)</span>
                                <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-emerald-400 group relative">
                                  <button onClick={() => copyToClipboard(`<localfile>\n  <log_format>apache</log_format>\n  <location>/var/log/nginx/access.log</location>\n</localfile>`)} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3.5 h-3.5 text-white" /></button>
                                  <pre className="text-[10px]">
{`<localfile>
  <log_format>apache</log_format>
  <location>/var/log/nginx/access.log</location>
</localfile>`}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">3. Save and Exit:</p>
                            <p className="text-[10px] text-neutral-600 italic">Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 border border-neutral-700 not-italic">Ctrl+O</kbd>, then <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 border border-neutral-700 not-italic">Enter</kbd> to save. Press <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 border border-neutral-700 not-italic">Ctrl+X</kbd> to exit.</p>
                          </div>
                        </div>

                        {/* Step 3: Restart */}
                        <div className="space-y-2">
                          <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-widest">Step 3: Restart Agent</p>
                          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-green-400 group relative">
                            <button onClick={() => copyToClipboard('sudo systemctl restart wazuh-agent')} className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3.5 h-3.5 text-white" /></button>
                            <code>sudo systemctl restart wazuh-agent</code>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between pt-6 border-t border-white/5">
                  <button onClick={() => setStep(selections.includes('firewall') ? 2 : 1)} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">Back</button>
                  <button 
                    onClick={() => setStep(4)}
                    className="bg-white text-black px-8 py-3 rounded-md font-bold text-[13px] transition-all flex items-center gap-2 hover:bg-neutral-200"
                  >
                    I've Installed it
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">Verify Your Connection</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">Waiting for agents to connect...</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(selections.includes('windows') || selections.includes('linux')) && (
                    <div className="bg-white/[0.03] border border-neutral-800 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Security Agents</h3>
                        <RefreshCw className="w-3 h-3 text-neutral-600 animate-spin" />
                      </div>
                      
                      {agents.length > 0 ? (
                        <div className="space-y-3">
                          {agents.map(agent => (
                            <div key={agent.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{agent.name}</p>
                                <p className="text-[10px] text-emerald-400 font-medium">Connected</p>
                              </div>
                              <span className="text-[9px] text-neutral-600 font-mono">
                                {new Date(agent.last_keepalive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                          <RefreshCw className="w-8 h-8 text-neutral-700 animate-spin" />
                          <div>
                            <p className="text-xs font-bold text-neutral-400">Waiting for agent...</p>
                            <p className="text-[10px] text-neutral-600 max-w-[150px] mx-auto">Install the agent on your endpoint to see it appear here</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selections.includes('firewall') && (
                    <div className="bg-white/[0.03] border border-neutral-800 rounded-xl p-6 space-y-4">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Firewall Verification</h3>
                      <div className="space-y-4">
                        <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">After configuring your{firewallConfig.brand}:</p>
                        <div className="space-y-2">
                          {[
                            'Syslog forwarding enabled on firewall',
                            `Firewall can reach ${WAZUH_IP}:514`
                          ].map((text, i) => (
                            <label key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/[0.08] transition-colors">
                              <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-black accent-red-500" />
                              <span className="text-[11px] font-medium text-neutral-400">{text}</span>
                            </label>
                          ))}
                        </div>
                        <button className="w-full py-3 rounded-lg border border-white/5 bg-white/5 text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                          Test Connection
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-8 border-t border-white/5">
                  <button 
                    onClick={() => { setSkipped(true); handleComplete(); }}
                    className="group flex items-center gap-2 text-neutral-600 hover:text-white transition-colors"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest">Skip for now</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={handleComplete}
                    disabled={agents.length === 0 && !skipped}
                    className="bg-white text-black px-10 py-4 rounded-md font-bold text-sm transition-all hover:bg-neutral-200 active:scale-95 disabled:opacity-30"
                  >
                    Complete Setup
                  </button>
                </div>

                <p className="text-[10px] text-neutral-600 text-center italic">
                  * You can complete this later in Settings &gt; Integrations
                </p>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div 
                key="step5"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="text-center py-6"
              >
                <div className="relative inline-block mb-10">
                  <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-500">
                    <CheckCircle2 className="w-12 h-12 text-blue-500" />
                  </div>
                </div>

                <div className="mb-10">
                  <h2 className="text-3xl font-bold mb-4 tracking-tight">Setup Complete!</h2>
                  <p className="text-neutral-500 max-w-sm mx-auto font-medium leading-relaxed mb-8">
                    Your KastronSec environment is now active. We are monitoring your infrastructure for threats.
                  </p>
                  
                  <div className="max-w-xs mx-auto text-left space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-6">
                    <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">You are monitoring:</h4>
                    {selections.includes('windows') && (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">Windows Endpoints <span className="text-neutral-500">({agents.filter(a => a.os_family?.includes('win')).length} active)</span></span>
                      </div>
                    )}
                    {selections.includes('linux') && (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold">Linux Servers <span className="text-neutral-500">({agents.filter(a => a.os_family?.includes('linux')).length} active)</span></span>
                      </div>
                    )}
                    {selections.includes('firewall') && (
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold">{firewallConfig.brand} Firewall <span className="text-neutral-500 font-medium">(pending)</span></span>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-[13px] font-medium mb-10">
                    {error}
                  </div>
                )}

                <button 
                  onClick={onComplete}
                  disabled={verifying}
                  className="bg-white text-black px-12 py-4 rounded-md font-bold text-sm transition-all hover:bg-neutral-200 active:scale-95 shadow-xl"
                >
                  {verifying ? 'Redirecting...' : 'Launch Dashboard'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        {/* Footer */}
        <div className="mt-16 flex items-center justify-center gap-12 opacity-30 grayscale">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Grade</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
