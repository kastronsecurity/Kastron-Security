import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Zap, 
  Globe, 
  ChevronRight, 
  CheckCircle2, 
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface LandingPageProps {
  onLogin: (user: any) => void;
  initialMode?: 'login' | 'signup';
  onBack?: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, initialMode = 'login', onBack }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        if (data.user) {
          onLogin(data.user);
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company_name: companyName,
              onboarding_completed: false
            }
          }
        });
        
        if (authError) throw authError;
        
        if (authData.user) {
          const installKey = crypto.randomUUID();
          const wazuhGroup = 'G-' + companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

          // Save to user metadata for persistence
          await supabase.auth.updateUser({
            data: { 
              install_key: installKey, 
              wazuh_group: wazuhGroup 
            }
          });

          // Call Edge Function to create client record (bypasses RLS)
          try {
            await supabase.functions.invoke('create-client', {
              body: {
                name: companyName,
                install_key: installKey,
                wazuh_group: wazuhGroup
              }
            });
          } catch (err) {
            console.error('Client record creation failed:', err);
          }

          // Create Wazuh agent group automatically via backend
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await fetch('/api/wazuh/groups', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ group_id: wazuhGroup })
              });
            }
          } catch (err) {
            console.error('Wazuh group creation failed:', err);
            // Don't block signup if Wazuh group creation fails
          }

          onLogin(authData.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: "AI-Driven Protection",
      description: "Advanced machine learning models that predict and prevent threats before they impact your network."
    },
    {
      icon: Zap,
      title: "Real-time XDR",
      description: "Extended detection and response across all your endpoints, cloud workloads, and identities."
    },
    {
      icon: Globe,
      title: "24/7 Managed SOC",
      description: "Expert security analysts monitoring your environment around the clock to ensure maximum uptime."
    }
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col lg:flex-row overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Left Side: Marketing Section */}
      <div className="lg:w-1/2 relative flex flex-col justify-center px-8 lg:px-20 py-12 border-r border-white/10 overflow-hidden z-10">
        {/* Hero Glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/[0.02] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          {onBack && (
            <button 
              onClick={onBack}
              className="mb-12 flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-all">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Back to Home</span>
            </button>
          )}
          <div className="flex items-center gap-2.5 mb-16 group cursor-pointer">
            <img src="/src/assets/logo.png" alt="KastronSec" className="w-8 h-8 object-contain transition-transform group-hover:scale-110" />
            <span className="text-xl font-bold tracking-tighter text-white">KastronSec</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-6xl font-bold text-white mb-8 leading-[1.1] tracking-tighter">
              Next-Gen Security <br />
              <span className="text-neutral-500">for the Modern Enterprise.</span>
            </h1>
            <p className="text-lg text-neutral-400 mb-16 max-w-lg leading-relaxed font-medium">
              KastronSec provides autonomous threat hunting and real-time response capabilities, 
              securing your digital assets with the power of advanced AI.
            </p>
          </motion.div>

          {/* Professional Security Intelligence Visualization */}
          <div className="relative mt-16 group">
            {/* Background Mesh Grid */}
            <div className="absolute inset-0 z-0 opacity-[0.05]" 
                 style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            <div className="relative z-10 space-y-6">
              {/* Main Intelligence Core */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-sm overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-6">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Active Intelligence</span>
                  </div>
                </div>

                <div className="flex items-start gap-8">
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                    <Shield className="w-8 h-8 text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 tracking-tight">KastronSec Core</h3>
                    <p className="text-neutral-500 text-sm font-medium leading-relaxed max-w-md">
                      Our proprietary security engine orchestrating autonomous threat detection and response across your entire infrastructure.
                    </p>
                  </div>
                </div>

                {/* Animated Data Stream */}
                <div className="mt-10 h-16 flex items-end gap-1.5">
                  {[...Array(32)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        height: [10, Math.random() * 40 + 10, 10],
                        opacity: [0.1, 0.3, 0.1]
                      }}
                      transition={{ 
                        duration: 2 + Math.random(), 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        delay: i * 0.05 
                      }}
                      className="flex-1 bg-white/20 rounded-t-[1px]"
                    />
                  ))}
                </div>
              </motion.div>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 + (index * 0.1) }}
                    className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-500 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-white/30 transition-all duration-500">
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-2 tracking-tight group-hover:text-neutral-300 transition-colors">
                      {feature.title}
                    </h4>
                    <p className="text-neutral-500 text-[11px] leading-relaxed font-medium">
                      {feature.description}
                    </p>
                    
                    {/* Professional Metric Label */}
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Status</span>
                      <span className="text-[9px] font-bold text-white uppercase tracking-widest">Optimized</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Subtle Decorative Elements */}
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-white/[0.02] blur-[100px] rounded-full pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Right Side: Auth Portal */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-20 bg-black relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-3 tracking-tighter">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-neutral-500 text-sm font-medium leading-relaxed">
              {isLogin 
                ? 'Enter your credentials to access your security portal.' 
                : 'Join KastronSec and start securing your infrastructure today.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-3 text-red-500 text-[13px] font-medium"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-white/[0.02] border border-white/10 rounded-md px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all text-sm"
              />
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-md px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Company Name</label>
                  <input 
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full bg-white/[0.02] border border-white/10 rounded-md px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button type="button" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-widest">Forgot Password?</button>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.02] border border-white/10 rounded-md px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-neutral-200 disabled:bg-white/10 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-bold py-3 rounded-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-10 border-t border-white/5 text-center">
            <p className="text-neutral-500 text-[13px] font-medium">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-white font-bold hover:text-blue-500 transition-colors"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">SOC2</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">GDPR</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;
