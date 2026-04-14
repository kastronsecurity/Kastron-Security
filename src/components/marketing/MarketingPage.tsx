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
  Monitor
} from 'lucide-react';
import logo from '../../assets/logo.png';
import BetaAgreementModal from './BetaAgreementModal';

interface MarketingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export default function MarketingPage({ onGetStarted, onLogin }: MarketingPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isBetaModalOpen, setIsBetaModalOpen] = useState(false);
  const { scrollY } = useScroll();
  
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 0.95]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Shield,
      title: "Real-Time Threat Detection",
      description: "Wazuh-powered SIEM detects attacks the moment they happen across all your endpoints.",
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      icon: Bot,
      title: "AI-Powered Analysis",
      description: "Claude AI analyses every alert and gives you instant context, severity assessment and response recommendations.",
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      icon: Search,
      title: "Threat Intelligence",
      description: "Automatic IP reputation checks against AbuseIPDB, VirusTotal and Shodan for every suspicious indicator.",
      color: "text-orange-500",
      bg: "bg-orange-500/10"
    },
    {
      icon: Lock,
      title: "Multi-Tenant Platform",
      description: "Complete isolation between clients — every organization sees only their own security data.",
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      icon: Terminal,
      title: "Custom Detection Rules",
      description: "Build and deploy your own Wazuh detection rules per client with full MITRE ATT&CK mapping.",
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    {
      icon: FileText,
      title: "Case Management",
      description: "Track, investigate and resolve security incidents with built-in case management and reporting.",
      color: "text-cyan-500",
      bg: "bg-cyan-500/10"
    }
  ];

  const steps = [
    {
      icon: Download,
      title: "Install Agent",
      description: "Deploy our lightweight Wazuh agent on any Linux or Windows machine using a single one-line command."
    },
    {
      icon: Activity,
      title: "Detect Threats",
      description: "The agent monitors your system in real time and sends alerts to the KastronSec platform instantly."
    },
    {
      icon: Cpu,
      title: "AI Analysis",
      description: "Every alert is analysed by our AI engine giving you instant context and recommended response actions."
    },
    {
      icon: ShieldCheck,
      title: "Respond & Resolve",
      description: "Investigate alerts, create cases, generate reports and close incidents — all from one dashboard."
    }
  ];

  const pricing = [
    {
      name: "Beta",
      price: "Free",
      subtext: "Full access during beta period",
      features: [
        "Unlimited agents",
        "Unlimited alerts",
        "Custom detection rules",
        "AI-powered analysis",
        "Threat intel lookups",
        "Report generation",
        "Case management",
        "Data retained for 30 days only"
      ],
      button: "Get Started — Free",
      popular: true,
      action: () => setIsBetaModalOpen(true)
    },
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      features: [
        "Up to 5 agents",
        "500 alerts/day",
        "Custom rules",
        "AI analysis",
        "Threat intel",
        "90 day data retention",
        "Email support"
      ],
      button: "Coming Soon",
      disabled: true
    },
    {
      name: "Professional",
      price: "$199",
      period: "/month",
      features: [
        "Up to 20 agents",
        "5000 alerts/day",
        "Custom rules",
        "Full AI analysis",
        "Threat intel",
        "1 year data retention",
        "Priority support",
        "Advanced reporting"
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
        "Everything in Professional",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee",
        "On-premise option"
      ],
      button: "Contact Sales",
      action: () => window.location.href = "mailto:kastronsec@gmail.com"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 scrollbar-hide">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-lg border-b border-neutral-800 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="KastronSec" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold tracking-tight flex items-center gap-2">
              KastronSec 
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Home</a>
            <a href="#features" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Pricing</a>
            <a href="#contact" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="hidden sm:block text-sm font-bold text-neutral-400 hover:text-white transition-colors"
            >
              Login
            </button>
            <button 
              onClick={() => setIsBetaModalOpen(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-95"
            >
              Try Beta
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Animation */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.1),transparent_50%)]" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <motion.div 
            animate={{ 
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px]" 
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center"
          >
            <img src={logo} alt="KastronSec Logo" className="w-32 h-32 mb-8 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500">
              Security Without Boundaries.
            </h1>
            <p className="max-w-2xl text-lg lg:text-xl text-neutral-400 mb-10 leading-relaxed">
              An AI-powered Security Operations Center platform that gives every business enterprise-grade protection. 
              Real-time threat detection, intelligent alerts, and automated response — all in one platform.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={() => setIsBetaModalOpen(true)}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] active:scale-95"
              >
                Try Beta — Free
              </button>
              <a 
                href="#features"
                className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold text-lg transition-all border border-neutral-800"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">Why KastronSec?</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">Enterprise-grade security tools, simplified for modern teams.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 bg-neutral-900/50 border border-neutral-800 rounded-3xl hover:border-neutral-700 transition-all group"
              >
                <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">Get up and running in minutes, not days.</p>
          </div>

          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
              {steps.map((step, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-black border-4 border-neutral-800 flex items-center justify-center mb-6 bg-neutral-900 shadow-xl">
                    <step.icon className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{step.title}</h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl lg:text-5xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">Start for free during our beta period.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map((plan, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`relative p-8 bg-neutral-900/50 border rounded-3xl flex flex-col ${plan.popular ? 'border-blue-600 ring-1 ring-blue-600' : 'border-neutral-800'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                    Most Popular
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-neutral-500 text-sm">{plan.period}</span>}
                  </div>
                  {plan.subtext && <p className="text-xs text-blue-500 font-medium mt-2">{plan.subtext}</p>}
                </div>

                <div className="flex-1 space-y-4 mb-8">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3 text-sm">
                      {feature.startsWith('⚠️') ? (
                        <span className="text-orange-500">⚠️</span>
                      ) : (
                        <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span className="text-neutral-400">{feature.replace('⚠️ ', '').replace('✅ ', '')}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={plan.action}
                  disabled={plan.disabled}
                  className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
                    plan.disabled 
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                      : plan.popular
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 active:scale-95'
                        : 'bg-white text-black hover:bg-neutral-200 active:scale-95'
                  }`}
                >
                  {plan.button}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/10 flex items-center justify-center mx-auto mb-8">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">Get in Touch</h2>
          <p className="text-neutral-400 mb-10">Have questions about KastronSec? We'd love to hear from you.</p>
          
          <a 
            href="mailto:kastronsec@gmail.com"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-bold text-lg hover:bg-neutral-200 transition-all active:scale-95"
          >
            <Mail className="w-5 h-5" />
            kastronsec@gmail.com
          </a>
          
          <div className="mt-12 flex items-center justify-center gap-2 text-neutral-500 text-sm">
            <span>Based in Sri Lanka</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-neutral-800 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img src={logo} alt="KastronSec" className="w-10 h-10 object-contain" />
                <span className="text-xl font-bold tracking-tight flex items-center gap-2">
                  KastronSec 
                </span>
              </div>
              <p className="text-neutral-500 text-sm leading-relaxed">
                Security Without Boundaries. Enterprise-grade protection for every organization.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6">Platform</h4>
              <ul className="space-y-4 text-sm text-neutral-500">
                <li><a href="#home" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Legal</h4>
              <ul className="space-y-4 text-sm text-neutral-500">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Beta Agreement</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">Connect</h4>
              <ul className="space-y-4 text-sm text-neutral-500">
                <li><a href="mailto:kastronsec@gmail.com" className="hover:text-white transition-colors">Contact Support</a></li>
                <li><a href="mailto:kastronsec@gmail.com" className="hover:text-white transition-colors">Sales Inquiry</a></li>
                <li className="flex items-center gap-2">
                  <span>Sri Lanka</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-600 font-medium">
            <p>© 2026 KastronSec. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Built with <span className="text-red-500">❤️</span> in Sri Lanka 
            </p>
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

// Missing icon from lucide-react
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
