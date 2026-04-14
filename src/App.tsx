/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Bell, 
  CircleDot, 
  Users, 
  Activity, 
  FileText, 
  UserCog, 
  ShieldCheck, 
  Share2, 
  History, 
  Settings, 
  Terminal, 
  Headset, 
  Search, 
  X, 
  ChevronRight, 
  ArrowDown, 
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  SearchCheck,
  Plus,
  Briefcase,
  RefreshCw,
  Monitor,
  Shield,
  Code,
  User
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getSeverityFromLevel } from './lib/utils';
import { SeverityBadge, StatusPill } from './components/ui/StatusElements';
import AlertsPage from './components/alerts/AlertsPage';
import CasesPage from './components/cases/CasesPage';
import AgentsPage from './components/administration/AgentsPage';
import CustomRulesPage from './components/administration/CustomRulesPage';
import LandingPage from './components/auth/LandingPage';
import OnboardingPage from './components/onboarding/OnboardingPage';
import MarketingPage from './components/marketing/MarketingPage';
import ReportsPage from './components/reports/ReportsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { supabase } from './lib/supabase';
import { useClient } from './contexts/ClientContext';
import logo from './assets/logo.png';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationToasts } from './components/ui/NotificationToast';
import { NotificationBell } from './components/ui/NotificationBell';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active = false, color, onClick, disabled = false }: { icon: any, label: string, active?: boolean, color?: string, onClick?: () => void, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group",
      active ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
      disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-neutral-400"
    )}
  >
    <Icon className={cn(
      "w-5 h-5 transition-colors duration-200", 
      active 
        ? (color || "text-white") 
        : cn("text-neutral-400", color ? `group-hover:${color}` : "group-hover:text-white"),
      disabled && "group-hover:text-neutral-400"
    )} />
    <span className="text-[13px] font-medium">{label}</span>
  </button>
);

const SectionHeader = ({ title, showMore = false, moreText = "View All", onMoreClick }: { title: string, showMore?: boolean, moreText?: string, onMoreClick?: () => void }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{title}</h3>
    {showMore && (
      <button 
        onClick={onMoreClick}
        className="text-[10px] text-neutral-500 font-bold flex items-center gap-1 hover:text-white transition-colors uppercase tracking-widest"
      >
        {moreText} <ChevronRight className="w-3 h-3" />
      </button>
    )}
  </div>
);

const UnderConstruction = ({ title }: { title: string }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md"
    >
      <div className="relative mb-8 inline-block">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
        <div className="relative w-24 h-24 bg-neutral-900 rounded-2xl border border-neutral-800 flex items-center justify-center shadow-2xl">
          <Settings className="w-12 h-12 text-blue-500 animate-[spin_8s_linear_infinite]" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black border border-neutral-800 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-tighter">{title}</h2>
      <div className="h-1 w-20 bg-blue-600 mx-auto mb-6 rounded-full" />
      
      <p className="text-neutral-400 text-sm leading-relaxed mb-8">
        Our engineers are currently deploying the advanced modules for this section. 
        The <span className="text-blue-400 font-mono">{title}</span> interface is being optimized for high-performance security operations.
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Status</p>
          <p className="text-xs text-blue-400 font-bold">In Development</p>
        </div>
        <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <p className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Priority</p>
          <p className="text-xs text-orange-500 font-bold">High</p>
        </div>
      </div>
    </motion.div>
  </div>
);

export default function App() {
  const { currentClient, user, loading: clientLoading, authLoading, refreshClient, agentCount, alertCount, onboardingCompleted } = useClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'alerts' | 'cases' | 'onboarding' | 'agents' | 'rules' | 'entities' | 'timeline' | 'reports' | 'user-cog' | 'integrations' | 'audit' | 'settings' | 'api-logs' | 'support'>('dashboard');
  
  const hasData = agentCount > 0 || alertCount > 0;

  // Handle initial page and redirection based on data presence
  useEffect(() => {
    if (onboardingCompleted && !hasData) {
      setCurrentPage('agents');
    } else if (onboardingCompleted && hasData && currentPage === 'agents' && !window.sessionStorage.getItem('manual_nav')) {
      // Only auto-redirect to dashboard if they were on agents page because of no data
      setCurrentPage('dashboard');
    }
  }, [hasData, onboardingCompleted]);
  const [latestAlerts, setLatestAlerts] = useState<any[]>([]);
  const [alertOverviewData, setAlertOverviewData] = useState([
    { name: 'Critical', value: 0, color: '#ef4444' },
    { name: 'High', value: 0, color: '#f97316' },
    { name: 'Medium', value: 0, color: '#3b82f6' },
    { name: 'Low', value: 0, color: '#737373' },
  ]);
  const [severityFrequencyData, setSeverityFrequencyData] = useState([
    { day: 'MON', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'TUE', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'WED', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'THU', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'FRI', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'SAT', critical: 0, high: 0, medium: 0, low: 0 },
    { day: 'SUN', critical: 0, high: 0, medium: 0, low: 0 },
  ]);
  const [metrics, setMetrics] = useState([
    { label: 'ALERTS', value: '--', subValue: 'Live', icon: AlertCircle, color: 'text-red-500' },
    { label: 'ENTITIES', value: '--', subValue: 'Synced', icon: Share2, color: 'text-neutral-400' },
    { label: 'INVESTIGATIONS', value: '--', subValue: 'In Progress', icon: Activity, color: 'text-orange-500' },
    { label: 'OPEN CASES', value: '--', subValue: 'Managed', icon: ShieldCheck, color: 'text-blue-500' },
  ]);
  const [correlatedEvents, setCorrelatedEvents] = useState<any[]>([]);
  const [activeCases, setActiveCases] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (!supabase || !user || !onboardingCompleted || !currentClient) {
      if (!supabase) {
        setDebugInfo('Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
        setConnectionStatus('error');
      }
      return;
    }

    const initDashboard = async () => {
      setConnectionStatus('connecting');
      const success = await fetchMetrics(0, currentClient.id);
      if (success) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
      }
    };

    initDashboard();
    
    // Listen for new alerts and cases to update metrics
    const channel = supabase
      .channel('dashboard_metrics')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'alerts',
        filter: `client_id=eq.${currentClient.id}`
      }, () => {
        console.log('Real-time alert update for metrics');
        fetchMetrics();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'cases',
        filter: `client_id=eq.${currentClient.id}`
      }, () => {
        console.log('Real-time case update for metrics');
        fetchMetrics();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setMetrics(prev => prev.map(m => m.label === 'ALERTS' ? { ...m, subValue: 'Live Connection' } : m));
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setConnectionStatus('error');
          setMetrics(prev => prev.map(m => m.label === 'ALERTS' ? { ...m, subValue: 'Reconnecting...' } : m));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onboardingCompleted, currentClient]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (typeof e.detail === 'string') {
        setCurrentPage(e.detail as any);
      } else if (e.detail && e.detail.page) {
        setCurrentPage(e.detail.page);
        if (e.detail.data) {
          window.sessionStorage.setItem('nav_data', JSON.stringify(e.detail.data));
        }
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const fetchMetrics = async (retryCount = 0, clientIdOverride?: string): Promise<boolean> => {
    if (!supabase || !user || !currentClient) return false;
    const clientId = clientIdOverride || currentClient.id;
    
    try {
      setIsRefreshing(true);
      
      // Optimized metrics fetching: only fetch what's needed for the dashboard
      // 1. Get counts for metrics
      // 2. Get latest alerts (limited)
      // 3. Get alerts from last 7 days for charts (limited by time)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      console.log(`Fetching optimized metrics from Supabase for client ${clientId}...`);
      
      const [
        totalAlertsRes,
        investigatingAlertsRes,
        casesCountRes,
        latestAlertsRes,
        recentAlertsRes,
        eventsRes,
        casesRes,
        agentsCountRes,
        criticalCountRes,
        highCountRes,
        mediumCountRes,
        lowCountRes
      ] = await Promise.all([
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'Investigating'),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('alerts').select('id, description, timestamp, severity, status, resolution_type').eq('client_id', clientId).order('timestamp', { ascending: false }).limit(5),
        supabase.from('alerts').select('severity, timestamp').eq('client_id', clientId).gte('timestamp', sevenDaysAgo.toISOString().split('T')[0]),
        supabase.from('events').select('*').eq('client_id', clientId).limit(5),
        supabase.from('cases').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(4),
        supabase.from('agents').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId).ilike('severity', 'critical'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId).ilike('severity', 'high'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId).ilike('severity', 'medium'),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', clientId).ilike('severity', 'low'),
      ]);

      if (totalAlertsRes.error) {
        console.error('Error fetching alerts count:', totalAlertsRes.error);
        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchMetrics(retryCount + 1, clientIdOverride);
        }
        setDebugInfo(`Supabase Error: ${totalAlertsRes.error.message}`);
        setConnectionStatus('error');
        setIsRefreshing(false);
        return false;
      }

      // Calculate Metrics
      const totalAlerts = totalAlertsRes.count || 0;
      const investigationsCount = investigatingAlertsRes.count || 0;
      const openCasesCount = casesCountRes.count || 0;
      const totalAgents = agentsCountRes.count || 0;
      
      // For unique entities, we'll use a reasonable sample from recent alerts
      const recentAlerts = recentAlertsRes.data || [];
      const uniqueEntities = new Set(recentAlerts.map(a => (a as any).agent_name || (a as any).source_ip)).size;

      // Update Latest Alerts
      setLatestAlerts((latestAlertsRes.data || []).map(a => {
        const dateStr = a.timestamp.includes(' ') ? a.timestamp.replace(' ', 'T') : a.timestamp;
        return {
          id: a.id,
          description: a.description || 'Wazuh Alert',
          date: new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          severity: a.severity,
          status: a.status,
          resolution_type: a.resolution_type
        };
      }));

      // Update Overview Chart Data
      setAlertOverviewData([
        { name: 'Critical', value: criticalCountRes.count || 0, color: '#ef4444' },
        { name: 'High', value: highCountRes.count || 0, color: '#f97316' },
        { name: 'Medium', value: mediumCountRes.count || 0, color: '#3b82f6' },
        { name: 'Low', value: lowCountRes.count || 0, color: '#737373' },
      ]);

      // Update Severity Alerts Frequency
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const frequencyData = days.map(day => ({ day, critical: 0, high: 0, medium: 0, low: 0 }));

      recentAlerts.forEach(alert => {
        const dateStr = alert.timestamp.includes(' ') ? alert.timestamp.replace(' ', 'T') : alert.timestamp;
        const alertDate = new Date(dateStr);
        const dayName = days[alertDate.getDay()];
        const dayObj = frequencyData.find(d => d.day === dayName);
        if (dayObj) {
          const sev = alert.severity?.toUpperCase();
          if (sev === 'CRITICAL') dayObj.critical++;
          else if (sev === 'HIGH') dayObj.high++;
          else if (sev === 'MEDIUM') dayObj.medium++;
          else if (sev === 'LOW') dayObj.low++;
        }
      });
      
      const mondayStart = [...frequencyData.slice(1), frequencyData[0]];
      setSeverityFrequencyData(mondayStart);

      setMetrics([
        { label: 'ALERTS', value: String(totalAlerts), subValue: 'Live', icon: AlertCircle, color: 'text-red-500' },
        { label: 'ENTITIES', value: String(totalAgents), subValue: 'Synced', icon: Share2, color: 'text-neutral-400' },
        { label: 'INVESTIGATIONS', value: String(investigationsCount), subValue: 'In Progress', icon: Activity, color: 'text-orange-500' },
        { label: 'OPEN CASES', value: String(openCasesCount), subValue: 'Managed', icon: ShieldCheck, color: 'text-blue-500' },
      ]);

      setCorrelatedEvents(eventsRes.data || []);
      setActiveCases((casesRes.data || []).map(c => ({
        id: c.id,
        name: c.title,
        alerts: 0,
        priority: c.severity,
        analyst: 'No Assignee'
      })));

      setIsRefreshing(false);
      return true;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      setIsRefreshing(false);
      return false;
    }
  };

  if (authLoading || clientLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-neutral-500 text-xs font-bold uppercase tracking-widest animate-pulse">Initializing SOC...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showAuth) {
      return (
        <LandingPage 
          onLogin={() => {}} 
          initialMode={authMode}
          onBack={() => setShowAuth(false)}
        />
      );
    }
    return (
      <MarketingPage 
        onGetStarted={() => {
          setAuthMode('signup');
          setShowAuth(true);
        }}
        onLogin={() => {
          setAuthMode('login');
          setShowAuth(true);
        }}
      />
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingPage user={user} onComplete={refreshClient} />;
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 flex flex-col bg-black flex-shrink-0">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-md overflow-hidden">
                <img 
                  src={logo} 
                  alt="KastronSec Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-white font-medium text-[13px]">KastronSec</span>
            </div>
            <ArrowDown className="w-4 h-4 text-neutral-500" />
          </div>

          <div className="px-2 py-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                {currentClient?.name || 'Loading Company...'}
              </span>
            </div>
          </div>

          <div className="relative group px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 group-focus-within:text-white transition-colors" />
            <input 
              type="text"
              placeholder="Search Alerts"
              className="w-full bg-[#111] border border-neutral-800 rounded-md pl-9 pr-14 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-neutral-500 transition-opacity duration-200",
              searchQuery || "opacity-0 group-focus-within:opacity-100"
            )}>
              <SearchCheck className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
              <Plus className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-6 scrollbar-hide pb-10">
          <div>
            <SectionHeader title="General" />
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={currentPage === 'dashboard'} 
              disabled={!hasData}
              onClick={() => {
                if (hasData) {
                  setCurrentPage('dashboard');
                  window.sessionStorage.setItem('manual_nav', 'true');
                }
              }} 
            />
          </div>

          <div>
            <SectionHeader title="Alert Investigation" />
            <div className="space-y-0.5">
              <SidebarItem 
                icon={Bell} 
                label="Alerts" 
                active={currentPage === 'alerts'} 
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('alerts');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }} 
              />
              <SidebarItem 
                icon={Briefcase} 
                label="Cases" 
                active={currentPage === 'cases'} 
                color="text-blue-500" 
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('cases');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
              <SidebarItem 
                icon={Users} 
                label="Entities" 
                active={currentPage === 'entities'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('entities');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
              <SidebarItem 
                icon={Activity} 
                label="Attack Timeline" 
                active={currentPage === 'timeline'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('timeline');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
              <SidebarItem 
                icon={FileText} 
                label="Reports" 
                active={currentPage === 'reports'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('reports');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
            </div>
          </div>

          <div>
            <SectionHeader title="Administration" />
            <div className="space-y-0.5">
              <SidebarItem 
                icon={Monitor} 
                label="Agent" 
                active={currentPage === 'agents'} 
                onClick={() => {
                  setCurrentPage('agents');
                  window.sessionStorage.setItem('manual_nav', 'true');
                }} 
                color="text-green-500"
              />
              <SidebarItem 
                icon={Code} 
                label="Rules" 
                active={currentPage === 'rules'} 
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('rules');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }} 
                color="text-blue-400"
              />
              <SidebarItem 
                icon={UserCog} 
                label="User" 
                active={currentPage === 'user-cog'}
                onClick={() => {
                  setCurrentPage('user-cog');
                  window.sessionStorage.setItem('manual_nav', 'true');
                }}
              />
              <SidebarItem 
                icon={Share2} 
                label="Integrations" 
                active={currentPage === 'integrations'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('integrations');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
              <SidebarItem 
                icon={History} 
                label="Audit Logs" 
                active={currentPage === 'audit'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('audit');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
            </div>
          </div>

          <div>
            <SectionHeader title="System" />
            <div className="space-y-0.5">
              <SidebarItem 
                icon={Settings} 
                label="Settings" 
                active={currentPage === 'settings'}
                onClick={() => {
                  setCurrentPage('settings');
                  window.sessionStorage.setItem('manual_nav', 'true');
                }}
              />
              <SidebarItem 
                icon={Terminal} 
                label="API Logs" 
                active={currentPage === 'api-logs'}
                disabled={!hasData}
                onClick={() => {
                  if (hasData) {
                    setCurrentPage('api-logs');
                    window.sessionStorage.setItem('manual_nav', 'true');
                  }
                }}
              />
              <SidebarItem 
                icon={Headset} 
                label="Support" 
                active={currentPage === 'support'}
                onClick={() => {
                  setCurrentPage('support');
                  window.sessionStorage.setItem('manual_nav', 'true');
                }}
              />
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-neutral-400 hover:bg-red-500/10 hover:text-red-500 transition-all group"
          >
            <History className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[13px] font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-black">
        {/* Header */}
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-8 bg-black z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-semibold text-lg tracking-tight capitalize">{currentPage}</h1>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                connectionStatus === 'connected' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : 
                connectionStatus === 'connecting' ? "bg-yellow-500" : "bg-red-500"
              )}></div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-5 text-neutral-400">
              <Search className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
              <NotificationBell />
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-neutral-800">
              <div className="text-right hidden sm:block">
                <p className="text-[12px] text-white font-medium leading-none mb-1">
                  {user?.email?.split('@')[0] || 'Analyst 01'}
                </p>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">Tier 2 Admin</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                <User className="w-4 h-4 text-neutral-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide"
            >


              {/* Top Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-neutral-800 rounded-xl overflow-hidden">
                {metrics.map((metric, idx) => (
                  <motion.div 
                    key={metric.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-8 border-r border-neutral-800 last:border-r-0 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <metric.icon className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{metric.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-4xl font-bold text-white tracking-tighter">{metric.value}</h3>
                      <span className={cn("text-[11px] font-semibold tracking-tight", metric.color)}>
                        {metric.subValue}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Alerts Overview */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="lg:col-span-5 bg-black border border-neutral-800 rounded-xl p-8 h-[380px] flex flex-col"
                >
                  <SectionHeader title="Alerts Overview" />
                  <div className="flex items-center justify-around flex-1">
                    <div className="relative w-44 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={alertOverviewData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {alertOverviewData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold text-white tracking-tighter">
                          {alertOverviewData.reduce((acc, curr) => acc + curr.value, 0)}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">Total</span>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {alertOverviewData.map((item) => (
                        <div key={item.name} className="flex items-center gap-6 justify-between min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-[11px] text-neutral-400">{item.name}</span>
                          </div>
                          <span className="text-[11px] font-bold text-white">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Alerts Frequency by Severity */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-7 bg-black border border-neutral-800 rounded-xl p-8 h-[380px] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-[12px] font-bold text-white uppercase tracking-widest">Alerts Frequency</h3>
                      <p className="text-[10px] text-neutral-500 font-medium mt-1">Activity by Severity</p>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-bold">
                      <span className="text-neutral-500">Last 7 days</span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded">
                        <span className="text-white">
                          {severityFrequencyData.reduce((acc, curr) => acc + curr.critical + curr.high + curr.medium + curr.low, 0)}
                        </span>
                        <span className="text-neutral-500">Total</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={severityFrequencyData}>
                        <CartesianGrid vertical={false} stroke="#262626" strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="day" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#525252', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '8px', fontSize: '10px' }}
                        />
                        <Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="high" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="medium" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={40} />
                        <Bar dataKey="low" stackId="a" fill="#737373" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Latest Alerts */}
                <div className="lg:col-span-6 bg-black border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[450px]">
                  <div className="px-6 py-5 border-b border-neutral-800">
                    <SectionHeader 
                      title="Latest Alerts" 
                      showMore 
                      moreText="View All Alerts" 
                      onMoreClick={() => setCurrentPage('alerts')} 
                    />
                  </div>
                  <div className="overflow-x-auto scrollbar-hide flex-1">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="text-neutral-500 border-b border-neutral-800 bg-white/[0.01] uppercase tracking-widest font-bold text-[10px]">
                          <th className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5 h-3.5 rounded border border-neutral-800" />
                              ID
                            </div>
                          </th>
                          <th className="px-6 py-4">Description</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Severity</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {latestAlerts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-20 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <p className="text-neutral-500">No recent alerts found.</p>
                                <button 
                                  onClick={() => setCurrentPage('alerts')}
                                  className="text-blue-500 hover:underline font-bold"
                                >
                                  Go to Alerts Page to Generate Data
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          latestAlerts.map((alert) => (
                            <tr key={alert.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer">
                              <td className="px-6 py-4 font-medium text-white">
                                <div className="flex items-center gap-3">
                                  <div className="w-3.5 h-3.5 rounded border border-neutral-800 group-hover:border-neutral-600 transition-colors" />
                                  {alert.id}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-neutral-400">{alert.description}</td>
                              <td className="px-6 py-4 text-neutral-400">{alert.date}</td>
                              <td className="px-6 py-4"><SeverityBadge severity={alert.severity} /></td>
                              <td className="px-6 py-4"><StatusPill status={alert.status === 'Closed' ? (alert.resolution_type || 'Closed') : alert.status} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Correlated Events */}
                <div className="lg:col-span-6 bg-black border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[450px]">
                  <div className="px-6 py-5 border-b border-neutral-800">
                    <SectionHeader title="Correlated Events" showMore moreText="+ View Alerts" />
                  </div>
                  <div className="overflow-x-auto scrollbar-hide flex-1">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="text-neutral-500 border-b border-neutral-800 bg-white/[0.01] uppercase tracking-widest font-bold text-[10px]">
                          <th className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-3.5 h-3.5 rounded border border-neutral-800" />
                              ID
                            </div>
                          </th>
                          <th className="px-6 py-4">Event Description</th>
                          <th className="px-6 py-4">Affected Entities</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                        {correlatedEvents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-20 text-center text-neutral-500">
                              No correlated events found.
                            </td>
                          </tr>
                        ) : (
                          correlatedEvents.map((event) => (
                            <tr key={event.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer group">
                              <td className="px-6 py-5 font-medium text-white">
                                <div className="flex items-center gap-3">
                                  <div className="w-3.5 h-3.5 rounded border border-neutral-800 group-hover:border-neutral-600 transition-colors" />
                                  {event.id}
                                </div>
                              </td>
                              <td className="px-6 py-5 text-neutral-400">{event.description}</td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium">{event.entity}</span>
                                  {event.count && <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-bold text-[9px]">{event.count}</span>}
                                  {event.total && <span className="text-neutral-600 font-medium">({event.total})</span>}
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('navigate', { 
                                      detail: { 
                                        page: 'reports', 
                                        data: { type: 'Escalation', alert: event, isGroup: true } 
                                      } 
                                    }));
                                  }}
                                  className="px-3 py-1 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] font-bold rounded border border-purple-500/20 transition-all"
                                >
                                  REPORT
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Active Cases */}
              <div className="bg-black border border-neutral-800 rounded-xl overflow-hidden">
                <div className="px-6 py-5 border-b border-neutral-800">
                  <SectionHeader 
                    title="Active Cases" 
                    showMore 
                    moreText="View All Cases" 
                    onMoreClick={() => setCurrentPage('cases')}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="text-neutral-500 border-b border-neutral-800 bg-white/[0.01] uppercase tracking-widest font-bold text-[10px]">
                        <th className="px-6 py-4">Case Name</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {activeCases.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-6 py-20 text-center text-neutral-500">
                            No active cases found.
                          </td>
                        </tr>
                      ) : (
                        activeCases.map((item) => (
                          <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer">
                            <td className="px-6 py-5 font-medium text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-3.5 h-3.5 rounded border border-neutral-800 group-hover:border-neutral-600 transition-colors" />
                                {item.name}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <MoreHorizontal className="w-4 h-4 text-neutral-600 hover:text-white transition-colors ml-auto" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : currentPage === 'alerts' ? (
            <AlertsPage key="alerts" user={user} />
          ) : currentPage === 'cases' ? (
            <CasesPage key="cases" user={user} />
          ) : currentPage === 'agents' ? (
            <AgentsPage key="agents" user={user} />
          ) : currentPage === 'rules' ? (
            <CustomRulesPage key="rules" />
          ) : currentPage === 'reports' ? (
            <ReportsPage key="reports" user={user} />
          ) : currentPage === 'settings' ? (
            <SettingsPage key="settings" />
          ) : (
            <UnderConstruction 
              key={currentPage} 
              title={
                currentPage === 'entities' ? 'Entities' :
                currentPage === 'timeline' ? 'Attack Timeline' :
                currentPage === 'user-cog' ? 'User Management' :
                currentPage === 'integrations' ? 'Integrations' :
                currentPage === 'audit' ? 'Audit Logs' :
                currentPage === 'api-logs' ? 'API Logs' :
                currentPage === 'support' ? 'Support' : 'Under Construction'
              } 
            />
          )}
        </AnimatePresence>
      </main>
      <NotificationToasts currentPage={currentPage} />
    </div>
  );
}
