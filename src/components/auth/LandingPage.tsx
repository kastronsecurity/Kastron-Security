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
    <div className="min-h-screen bg-black flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side: Marketing Section */}
      <div className="lg:w-1/2 relative flex flex-col justify-center px-8 lg:px-20 py-12 bg-[#050505] border-r border-neutral-800 overflow-hidden">
        {/* Background Grids/Nodes Decoration */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,#1d4ed8_0%,transparent_50%)]"></div>
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_70%,#1e1b4b_0%,transparent_50%)]"></div>
          <div className="grid grid-cols-12 h-full w-full opacity-10">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-neutral-700 h-20 w-full"></div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          {onBack && (
            <button 
              onClick={onBack}
              className="mb-8 flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-neutral-700">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </div>
              <span className="text-sm font-medium">Back to Home</span>
            </button>
          )}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Shield className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Kastron<span className="text-blue-500">Sec</span></span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
              Next-Gen Security <br />
              <span className="text-neutral-500">for the Modern Enterprise.</span>
            </h1>
            <p className="text-lg text-neutral-400 mb-12 max-w-lg leading-relaxed">
              KastronSec provides autonomous threat hunting and real-time response capabilities, 
              securing your digital assets with the power of advanced AI.
            </p>
          </motion.div>

          <div className="space-y-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + (index * 0.1) }}
                className="flex gap-5 group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-neutral-800/50 flex items-center gap-8">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-[#050505] bg-neutral-800 flex items-center justify-center"
                >
                  <User className="w-5 h-5 text-neutral-400" />
                </div>
              ))}
            </div>
            <p className="text-neutral-500 text-sm">
              Trusted by <span className="text-white font-medium">500+ enterprises</span> worldwide.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Portal */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-20 bg-black">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-neutral-500">
              {isLogin 
                ? 'Enter your credentials to access your security portal.' 
                : 'Join KastronSec and start securing your infrastructure today.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
              />
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Company Name</label>
                  <input 
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button type="button" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">Forgot Password?</button>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-neutral-800 text-center">
            <p className="text-neutral-500 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-white font-semibold hover:text-blue-500 transition-colors"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          <div className="mt-12 flex items-center justify-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">SOC2 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">GDPR Compliant</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingPage;
