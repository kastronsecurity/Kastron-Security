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
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface OnboardingPageProps {
  user: any;
  onComplete: () => void;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installKey, setInstallKey] = useState<string | null>(null);
  const [wazuhGroup, setWazuhGroup] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);

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
        .select('install_key, wazuh_group')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setInstallKey(data.install_key);
        setWazuhGroup(data.wazuh_group);
        
        // If metadata is missing or different, update it to stay in sync
        if (data.install_key !== metaInstallKey) {
          await supabase.auth.updateUser({
            data: { 
              install_key: data.install_key, 
              wazuh_group: data.wazuh_group 
            }
          });
        }
      } else if (error && (error.code === 'PGRST116' || error.message?.includes('no rows'))) {
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

  const handleComplete = async () => {
    if (!supabase || !user) return;
    setVerifying(true);
    try {
      // Update user metadata to mark onboarding as complete
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Hero Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        {/* Header */}
        <div className="text-center mb-16 relative">
          <div className="absolute -top-12 right-0 flex items-center gap-6">
            {user.user_metadata?.onboarding_completed && (
              <button 
                onClick={onComplete}
                className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
              >
                <ArrowLeft className="w-3 h-3" />
                Dashboard
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
          
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-all duration-500 border",
                step >= i 
                  ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
                  : "bg-black border-white/10 text-neutral-600"
              )}>
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                step >= i ? "text-white" : "text-neutral-600"
              )}>
                Step {i}
              </span>
            </div>
          ))}
        </div>

        {/* Steps Content */}
        <div className="bg-black border border-white/10 rounded-2xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/50 via-white/50 to-blue-500/50 opacity-20" />
          
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
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">Download Agent Installer</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">Select the operating system for your primary endpoint or server.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                  {installers.map((os) => (
                    <button 
                      key={os.name}
                      onClick={() => setStep(2)}
                      className="group p-8 bg-black hover:bg-white/[0.02] transition-colors text-left flex flex-col"
                    >
                      <os.icon className={cn("w-8 h-8 mb-6 transition-transform group-hover:scale-110", os.color)} />
                      <h3 className="font-bold text-base mb-2 tracking-tight">{os.name}</h3>
                      <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 uppercase tracking-widest">
                        <span>{os.version}</span>
                        <span>{os.size}</span>
                      </div>
                      <div className="mt-6 flex items-center gap-2 text-white text-[11px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        Download <Download className="w-3 h-3" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl flex items-start gap-4">
                  <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                  <p className="text-[13px] text-neutral-400 leading-relaxed font-medium">
                    Our agents are lightweight (less than 1% CPU usage) and designed for zero-interruption security monitoring.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-3 tracking-tight">Install & Configure</h2>
                  <p className="text-neutral-500 text-sm font-medium leading-relaxed">Run the installer on your target machine using the command below.</p>
                  {wazuhGroup && (
                    <div className="mt-6 p-2.5 bg-white/[0.02] border border-white/5 rounded-md inline-flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                        Agent Group: <span className="text-white">{wazuhGroup}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Terminal className="w-4 h-4" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest">Linux Installation</h3>
                    </div>
                    <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-5 font-mono text-[13px] group relative">
                      <div className="flex items-center justify-between mb-4 text-neutral-600 text-[10px] font-bold uppercase tracking-widest">
                        <span>Run as Root</span>
                        <span className="px-2 py-0.5 bg-white/5 rounded text-white">BASH</span>
                      </div>
                      <code className="text-blue-400 break-all leading-relaxed">
                        {loadingKey ? (
                          <span className="flex items-center gap-2 text-neutral-600 italic">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Fetching installation key...
                          </span>
                        ) : !installKey ? (
                          <div className="flex flex-col items-center gap-2 py-2">
                            <span className="text-red-500 italic text-xs">
                              {error || 'Installation key not found.'}
                            </span>
                            <button 
                              onClick={fetchClientData}
                              className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </button>
                          </div>
                        ) : (
                          `curl -s "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=linux" | sudo bash`
                        )}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Monitor className="w-4 h-4" />
                      <h3 className="text-[11px] font-bold uppercase tracking-widest">Windows Installation</h3>
                    </div>
                    <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-5 font-mono text-[13px] group relative">
                      <div className="flex items-center justify-between mb-4 text-neutral-600 text-[10px] font-bold uppercase tracking-widest">
                        <span>Run as Administrator</span>
                        <span className="px-2 py-0.5 bg-white/5 rounded text-white">POWERSHELL</span>
                      </div>
                      <code className="text-blue-400 break-all leading-relaxed">
                        {loadingKey ? (
                          <span className="flex items-center gap-2 text-neutral-600 italic">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Fetching installation key...
                          </span>
                        ) : !installKey ? (
                          <div className="flex flex-col items-center gap-2 py-2">
                            <span className="text-red-500 italic text-xs">
                              {error || 'Installation key not found.'}
                            </span>
                            <button 
                              onClick={fetchClientData}
                              className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </button>
                          </div>
                        ) : (
                          `powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=windows' -OutFile '$env:TEMP\\kastronsec-install.ps1'; & '$env:TEMP\\kastronsec-install.ps1'"`
                        )}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-white/5">
                  <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">Back</button>
                  <button 
                    onClick={handleComplete}
                    disabled={verifying}
                    className="bg-white text-black px-8 py-3 rounded-md font-bold text-[13px] transition-all flex items-center gap-2 hover:bg-neutral-200 active:scale-95"
                  >
                    {verifying ? 'Finalizing...' : 'Take me to Dashboard'}
                    {!verifying && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="text-center py-12"
              >
                <div className="relative inline-block mb-10">
                  <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center transition-all duration-500">
                    <CheckCircle2 className="w-12 h-12 text-blue-500" />
                  </div>
                  {verifying && (
                    <div className="absolute -inset-4 border-2 border-white/5 border-t-white rounded-full animate-spin"></div>
                  )}
                </div>

                <div className="mb-12">
                  <h2 className="text-3xl font-bold mb-4 tracking-tight">
                    Installation Complete?
                  </h2>
                  <p className="text-neutral-500 max-w-sm mx-auto font-medium leading-relaxed">
                    Once you've installed the agent on your machine, click the button below to access your security dashboard.
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-red-500 text-[13px] font-medium mb-10 flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-6 items-center">
                  <button 
                    onClick={handleComplete}
                    disabled={verifying}
                    className="bg-white text-black px-12 py-4 rounded-md font-bold text-sm transition-all hover:bg-neutral-200 active:scale-95 shadow-xl"
                  >
                    {verifying ? 'Finalizing...' : 'Launch Dashboard'}
                  </button>
                  <button onClick={() => setStep(2)} className="text-neutral-500 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest">
                    Back to Command
                  </button>
                </div>
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
