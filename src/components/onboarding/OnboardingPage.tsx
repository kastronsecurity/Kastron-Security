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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-3xl relative z-10">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <div className="absolute -top-4 right-0 flex items-center gap-4">
            {user.user_metadata?.onboarding_completed && (
              <button 
                onClick={onComplete}
                className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-6">
            <Lock className="w-3 h-3" />
            Secure Onboarding
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Kastron<span className="text-blue-500">Sec</span></h1>
          <p className="text-neutral-500 text-lg max-w-lg mx-auto">
            Let's get your infrastructure secured. Follow these simple steps to deploy your first agent.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-500 border-2",
                step >= i ? "bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-neutral-900 border-neutral-800 text-neutral-600"
              )}>
                {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
              </div>
              {i < 3 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-4 transition-all duration-500",
                  step > i ? "bg-blue-600" : "bg-neutral-800"
                )}></div>
              )}
            </div>
          ))}
        </div>

        {/* Steps Content */}
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-3xl p-8 lg:p-12 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Download Agent Installer</h2>
                  <p className="text-neutral-500">Select the operating system for your primary endpoint or server.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {installers.map((os) => (
                    <button 
                      key={os.name}
                      onClick={() => setStep(2)}
                      className="group p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl hover:border-blue-500/50 hover:bg-neutral-900 transition-all text-left"
                    >
                      <os.icon className={cn("w-8 h-8 mb-4 transition-transform group-hover:scale-110", os.color)} />
                      <h3 className="font-bold text-lg mb-1">{os.name}</h3>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>{os.version}</span>
                        <span>{os.size}</span>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-blue-500 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Download <Download className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-4">
                  <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Our agents are lightweight (less than 1% CPU usage) and designed for zero-interruption security monitoring.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Install & Configure</h2>
                  <p className="text-neutral-500">Run the installer on your target machine using the command below.</p>
                  {wazuhGroup && (
                    <div className="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded-lg inline-flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <p className="text-xs font-medium text-neutral-400">
                        Your agent group: <span className="text-white font-bold">{wazuhGroup}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Terminal className="w-5 h-5" />
                      <h3 className="font-bold">Linux Installation</h3>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-sm group relative">
                      <div className="flex items-center justify-between mb-2 text-neutral-500 text-xs">
                        <span>Run as Root</span>
                        <span className="px-2 py-0.5 bg-neutral-900 rounded text-[10px]">BASH</span>
                      </div>
                      <code className="text-blue-400 break-all">
                        {loadingKey ? (
                          <span className="flex items-center gap-2 text-neutral-600 italic">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Fetching your secure installation key...
                          </span>
                        ) : !installKey ? (
                          <div className="flex flex-col items-center gap-2 py-2">
                            <span className="text-red-500 italic text-xs">
                              {error || 'Installation key not found.'}
                            </span>
                            <button 
                              onClick={fetchClientData}
                              className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry Connection
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
                      <Monitor className="w-5 h-5" />
                      <h3 className="font-bold">Windows Installation</h3>
                    </div>
                    <div className="bg-black border border-neutral-800 rounded-xl p-4 font-mono text-sm group relative">
                      <div className="flex items-center justify-between mb-2 text-neutral-500 text-xs">
                        <span>Run as Administrator</span>
                        <span className="px-2 py-0.5 bg-neutral-900 rounded text-[10px]">POWERSHELL</span>
                      </div>
                      <code className="text-blue-400 break-all">
                        {loadingKey ? (
                          <span className="flex items-center gap-2 text-neutral-600 italic">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Fetching your secure installation key...
                          </span>
                        ) : !installKey ? (
                          <div className="flex flex-col items-center gap-2 py-2">
                            <span className="text-red-500 italic text-xs">
                              {error || 'Installation key not found.'}
                            </span>
                            <button 
                              onClick={fetchClientData}
                              className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry Connection
                            </button>
                          </div>
                        ) : (
                          `powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '${import.meta.env.VITE_SUPABASE_URL}/functions/v1/install-agent?key=${installKey}&os=windows' -OutFile '$env:TEMP\\kastronsec-install.ps1'; & '$env:TEMP\\kastronsec-install.ps1'"`
                        )}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-white transition-colors font-semibold">Back</button>
                  <button 
                    onClick={handleComplete}
                    disabled={verifying}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                  >
                    {verifying ? 'Finalizing...' : 'I have installed the agent, take me to the Dashboard'}
                    {!verifying && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-12 text-center"
              >
                <div className="relative inline-block mb-8">
                  <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center transition-all duration-500">
                    <CheckCircle2 className="w-12 h-12 text-blue-500" />
                  </div>
                  {verifying && (
                    <div className="absolute -inset-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Installation Complete?
                  </h2>
                  <p className="text-neutral-500 max-w-sm mx-auto mb-8">
                    Once you've installed the agent on your machine, click the button below to access your security dashboard.
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm mb-8 flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-4 items-center">
                  <button 
                    onClick={handleComplete}
                    disabled={verifying}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-12 py-4 rounded-xl font-bold transition-all shadow-xl flex items-center gap-3"
                  >
                    {verifying ? 'Finalizing...' : 'I have installed the agent, take me to the Dashboard'}
                  </button>
                  <button onClick={() => setStep(2)} className="text-neutral-500 hover:text-white transition-colors text-sm font-semibold">
                    Wait, I need to check the command again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-8 opacity-40 grayscale">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise Grade</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
