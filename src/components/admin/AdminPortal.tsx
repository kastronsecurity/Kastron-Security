import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Shield, 
  Users, 
  CreditCard, 
  List, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Search,
  Bell,
  ExternalLink,
  ChevronRight,
  Eye,
  MessageSquare,
  ShieldAlert,
  Activity,
  History,
  Terminal,
  Clock,
  Briefcase,
  Monitor,
  User,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { cn, getSeverityFromLevel } from '../../lib/utils';
import { SeverityBadge } from '../ui/StatusElements';
import AdminOverview from './AdminOverview';
import AdminRuleRequests from './AdminRuleRequests';
import AdminClients from './AdminClients';
import AdminSubscriptions from './AdminSubscriptions';
import AdminAuditLog from './AdminAuditLog';
import { useClient } from '../../contexts/ClientContext';
import logo from '../../assets/logo.png';

export default function AdminPortal() {
  const { user, isAdmin, adminRole } = useClient();
  const [currentPage, setCurrentPage] = useState<'overview' | 'rules' | 'clients' | 'subscriptions' | 'audit'>('overview');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();

    // Real-time subscription for rule requests
    const channel = supabase.channel('admin_rule_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rule_approval_requests'
      }, () => {
        fetchPendingCount();
        // Here you would typically trigger a toast, but this component needs access to context
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rule_approval_requests'
      }, () => {
        fetchPendingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('rule_approval_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isAdmin) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Access Denied</h2>
          <p className="text-neutral-500 text-sm">You do not have administrative privileges.</p>
        </div>
      </div>
    );
  }

  const SidebarItem = ({ icon: Icon, label, id, badge }: { icon: any, label: string, id: string, badge?: number }) => (
    <button 
      onClick={() => setCurrentPage(id as any)}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 group relative",
        currentPage === id ? "bg-red-500/10 text-white border border-red-500/20" : "text-neutral-400 hover:bg-white/5 hover:text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn(
          "w-4 h-4 transition-colors",
          currentPage === id ? "text-red-500" : "text-neutral-500 group-hover:text-white"
        )} />
        <span className="text-[12px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full shadow-lg shadow-red-600/40">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-neutral-800 flex flex-col bg-black flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-widest leading-none">ADMIN</h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1 tracking-tighter">KastronSec Portal</p>
            </div>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Overview" id="overview" />
            <SidebarItem icon={Shield} label="Rule Requests" id="rules" badge={pendingCount} />
            <SidebarItem icon={Users} label="Clients" id="clients" />
            <SidebarItem icon={CreditCard} label="Subscriptions" id="subscriptions" />
            <SidebarItem icon={List} label="Audit Log" id="audit" />
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-2">Logged in as</p>
            <p className="text-[11px] text-white font-bold truncate mb-1">{user?.email}</p>
            <span className="inline-block px-1.5 py-0.5 bg-red-600/10 border border-red-600/20 text-red-500 text-[9px] font-black rounded uppercase tracking-widest">
              {adminRole || 'ADMIN'}
            </span>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-neutral-500 hover:bg-red-600/10 hover:text-red-500 transition-all group border border-transparent hover:border-red-600/20"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[12px] font-bold uppercase tracking-widest">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-black">
        {/* Top Header */}
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-8 bg-black z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 text-red-500">
              <Activity className="w-4 h-4" />
              KASTRONSEC ADMIN PORTAL
            </h1>
            <div className="px-2 py-0.5 bg-red-600 rounded text-[9px] font-black text-white uppercase tracking-widest shadow-lg shadow-red-600/20">
              {adminRole === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 border-r border-neutral-800 pr-6">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-black bg-neutral-800 flex items-center justify-center">
                    <User className="w-3 h-3 text-neutral-500" />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">3 Active Admins</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] text-neutral-500 font-black uppercase tracking-tighter leading-none mb-1">System Health</p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[11px] text-green-500 font-bold">OPERATIONAL</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnimatePresence mode="wait">
            {currentPage === 'overview' && <AdminOverview key="overview" />}
            {currentPage === 'rules' && <AdminRuleRequests key="rules" />}
            {currentPage === 'clients' && <AdminClients key="clients" />}
            {currentPage === 'subscriptions' && <AdminSubscriptions key="subscriptions" />}
            {currentPage === 'audit' && <AdminAuditLog key="audit" />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
