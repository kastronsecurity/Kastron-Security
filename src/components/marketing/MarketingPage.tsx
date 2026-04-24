import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { 
  Shield, 
  Zap, 
  Globe, 
  Terminal, 
  Activity, 
  FileText, 
  Check, 
  ArrowRight, 
  Mail, 
  ChevronRight,
  ShieldCheck,
  Bot,
  Search,
  Lock,
  Cpu,
  Monitor,
  Layers,
  Command,
  Code
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import BetaAgreementModal from './BetaAgreementModal';
import { cn } from '../../lib/utils';

interface MarketingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function MarketingPage({ onGetStarted, onLogin }: MarketingPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false);
  const { scrollY } = useScroll();
  
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.98]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Shield,
      title: "Real-Time Detection",
      description: "Wazuh-powered SIEM detects attacks the moment they happen across all your endpoints.",
      color: "text-blue-400"
    },
    {
      icon: Bot,
      title: "AI-Powered Analysis",
      description: "Claude AI analyses every alert and gives you instant context and response recommendations.",
      color: "text-purple-400"
    },
    {
      icon: Search,
      title: "Threat Intelligence",
      description: "Automatic IP reputation checks against AbuseIPDB, VirusTotal and Shodan.",
      color: "text-orange-400"
    },
    {
      icon: Lock,
      title: "Multi-Tenant Platform",
      description: "Complete isolation between clients — every organization sees only their own data.",
      color: "text-green-400"
    },
    {
      icon: Terminal,
      title: "Custom Rules",
      description: "Build and deploy your own Wazuh detection rules with full MITRE ATT&CK mapping.",
      color: "text-red-400"
    },
    {
      icon: Layers,
      title: "Case Management",
      description: "Track, investigate and resolve security incidents with built-in case management.",
      color: "text-cyan-400"
    }
  ];

  const pricing = [
    {
      name: "Beta",
      price: "Free",
      subtext: "Free for 3 months",
      features: [
        "Unlimited agents",
        "Unlimited alerts",
        "AI-powered analysis",
        "30 day data retention",
        "Community support"
      ],
      button: "Start Beta",
      popular: true,
      action: () => setIsBetaModalOpen(true)
    },
    {
      name: "Plus",
      price: "$49",
      period: "/mo",
      features: [
        "Up to 10 agents",
        "1,000 alerts / day",
        "AI-powered analysis",
        "90 day data retention",
        "Email support"
      ],
      button: "Coming Soon",
      disabled: true
    },
    {
      name: "Pro",
      price: "$149",
      period: "/mo",
      features: [
        "Up to 50 agents",
        "10,000 alerts / day",
        "Full AI analysis suite",
        "1 year data retention",
        "Priority support"
      ],
      button: "Coming Soon",
      disabled: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      features: [
        "Unlimited agents",
        "Unlimited alerts",
        "Custom integrations",
        "Dedicated account manager",
        "SLA guarantee"
      ],
      button: "Contact Sales",
      action: () => window.location.href = "mailto:kastronsec@gmail.com"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black selection:bg-opacity-90">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled ? "bg-black/80 backdrop-blur-md border-white/10 py-3" : "bg-transparent border-transparent py-5"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Logo className="w-10 h-10" />
            </div>
            <span className="text-lg font-bold tracking-tighter">KastronSec</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How it works', 'Pricing', 'Contact'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} 
                className="text-[13px] font-medium text-neutral-400 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="text-[13px] font-medium text-neutral-400 hover:text-white transition-colors px-4"
            >
              Log in
            </button>
            <button 
              onClick={() => setIsBetaModalOpen(true)}
              className="px-4 py-1.5 bg-white text-black rounded-md text-[13px] font-semibold transition-all hover:bg-neutral-200 active:scale-95"
            >
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 overflow-hidden">
        {/* Hero Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="flex flex-col items-center text-center"
          >
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-neutral-400 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Now in Public Beta
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl lg:text-8xl font-bold tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 leading-[1.1]"
            >
              Security without <br className="hidden lg:block" /> boundaries.
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-2xl text-lg lg:text-xl text-neutral-400 mb-12 leading-relaxed font-medium"
            >
              An AI-powered SOC platform that gives every business enterprise-grade protection. 
              Real-time threat detection, intelligent alerts, and automated response.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <button 
                onClick={() => setIsBetaModalOpen(true)}
                className="w-full sm:w-auto px-8 py-3 bg-white text-black rounded-md font-bold text-sm transition-all hover:bg-neutral-200 active:scale-95 flex items-center gap-2"
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </button>
              <a 
                href="#features"
                className="w-full sm:w-auto px-8 py-3 bg-black border border-white/10 text-white rounded-md font-bold text-sm transition-all hover:bg-white/5 active:scale-95"
              >
                Documentation
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-2xl overflow-hidden">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="p-10 bg-black transition-colors group relative"
              >
                <div className={cn("w-10 h-10 mb-6 transition-transform group-hover:scale-110", feature.color)}>
                  <feature.icon className="w-full h-full" />
                </div>
                <h3 className="text-lg font-bold mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-neutral-500 text-[14px] leading-relaxed font-medium">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-32 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="flex-1 space-y-8">
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tighter leading-tight">
                Deploy in seconds. <br />
                Monitor in real-time.
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed font-medium">
                Our lightweight agent can be deployed on any server with a single command. 
                Once active, it immediately begins streaming security telemetry to our AI engine.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: Command, text: "Single command installation" },
                  { icon: Activity, text: "Real-time telemetry streaming" },
                  { icon: Bot, text: "Automated AI alert analysis" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-medium text-neutral-300">
                    <item.icon className="w-4 h-4 text-blue-500" />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full">
              <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-1 font-mono text-[13px] shadow-2xl">
                <div className="bg-black rounded-lg p-6 overflow-hidden">
                  <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    <span className="ml-2 text-neutral-600 text-[11px] font-bold uppercase tracking-widest">Terminal</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-neutral-500">$ curl -s https://kastron-security.onrender.com/install | bash</p>
                    <p className="text-blue-400">Checking system compatibility...</p>
                    <p className="text-green-400">✓ System compatible (Ubuntu 22.04)</p>
                    <p className="text-blue-400">Downloading KastronSec Agent v2.4.1...</p>
                    <p className="text-neutral-300">Installing agent service...</p>
                    <p className="text-green-400 font-bold">✓ Agent successfully deployed and connected</p>
                    <p className="text-neutral-500 animate-pulse">_</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tighter mb-4">Pricing Plans</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto font-medium">Simple, transparent pricing for teams of all sizes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map((plan, idx) => (
              <div 
                key={idx}
                className={cn(
                  "relative p-8 bg-black border rounded-2xl flex flex-col transition-all",
                  plan.popular ? "border-white" : "border-white/10"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-full">
                    Recommended
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-neutral-400 mb-4 uppercase tracking-widest">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-neutral-500 text-sm font-medium">{plan.period}</span>}
                  </div>
                  {plan.subtext && <p className="text-xs text-blue-400 font-bold mt-2">{plan.subtext}</p>}
                </div>

                <div className="flex-1 space-y-4 mb-10">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3 text-[13px]">
                      <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-neutral-400 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={plan.action}
                  disabled={plan.disabled}
                  className={cn(
                    "w-full py-3 rounded-md font-bold text-[13px] transition-all",
                    plan.disabled 
                      ? "bg-white/5 text-neutral-600 cursor-not-allowed border border-white/5" 
                      : plan.popular
                        ? "bg-white text-black hover:bg-neutral-200 active:scale-95"
                        : "bg-black text-white border border-white/10 hover:bg-white/5 active:scale-95"
                  )}
                >
                  {plan.button}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-6xl font-bold tracking-tighter mb-8">
            Ready to secure your <br /> infrastructure?
          </h2>
          <p className="text-neutral-400 text-lg mb-12 font-medium">
            Join the beta today and get full access to enterprise-grade security tools.
          </p>
          <button 
            onClick={() => setIsBetaModalOpen(true)}
            className="px-10 py-4 bg-white text-black rounded-md font-bold text-lg transition-all hover:bg-neutral-200 active:scale-95"
          >
            Get Started for Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <div className="space-y-6 max-w-xs">
              <div className="flex items-center gap-3">
                <Logo className="w-12 h-12" />
                <span className="text-xl font-bold tracking-tighter">KastronSec</span>
              </div>
              <p className="text-neutral-500 text-sm leading-relaxed font-medium">
                Security Without Boundaries. Enterprise-grade protection for every organization.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
              <div>
                <h4 className="text-white text-sm font-bold mb-6 tracking-tight">Product</h4>
                <ul className="space-y-4 text-[13px] text-neutral-500 font-medium">
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white text-sm font-bold mb-6 tracking-tight">Company</h4>
                <ul className="space-y-4 text-[13px] text-neutral-500 font-medium">
                  <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white text-sm font-bold mb-6 tracking-tight">Legal</h4>
                <ul className="space-y-4 text-[13px] text-neutral-500 font-medium">
                  <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-neutral-600 font-medium">
            <p>© 2026 KastronSec. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>

      <BetaAgreementModal 
        isOpen={isBetaModalOpen} 
        onClose={() => setIsBetaModalOpen(false)} 
        onAgree={() => {
          setIsBetaModalOpen(false);
          onGetStarted();
        }}
      />
    </div>
  );
}

function Download(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
