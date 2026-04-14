import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Mail, 
  Plus, 
  Search, 
  Calendar, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Users,
  Zap,
  Printer,
  Share2,
  X,
  AlertTriangle,
  BarChart2,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { SeverityBadge } from '../ui/StatusElements';
import { supabase } from '../../lib/supabase';
import { useClient } from '../../contexts/ClientContext';
import { generateStructuredSOCReport } from '../../lib/gemini';
import { downloadIncidentReport, downloadWeeklyReport, downloadExecutiveReport } from '../../utils/reportExporter';

// --- Types ---

interface Report {
  id: string;
  client_id: string;
  title: string;
  type: 'incident_report' | 'weekly_summary' | 'executive';
  status: 'draft' | 'in_review' | 'approved' | 'sent';
  content: any;
  alert_id?: string;
  date_from?: string;
  date_to?: string;
  agent_name?: string;
  generated_by: string;
  approved_by?: string;
  sent_to?: string[];
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
}

// --- Components ---

const StatCard = ({ label, value, subValue, icon: Icon, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-black border border-neutral-800 p-6 rounded-2xl flex flex-col justify-between h-32"
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">{label}</span>
      <div className={cn("p-2 rounded-lg bg-neutral-900", color)}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-bold text-white tracking-tighter leading-none">{value}</span>
      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{subValue}</span>
    </div>
  </motion.div>
);

const Badge = ({ children, variant }: { children: React.ReactNode, variant: string }) => {
  const variants: any = {
    incident_report: "bg-red-500/10 text-red-500 border-red-500/20",
    weekly_summary: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    executive: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    draft: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
    in_review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    sent: "bg-blue-600/10 text-blue-400 border-blue-600/20",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border", variants[variant])}>
      {children.toString().replace('_', ' ')}
    </span>
  );
};

export default function ReportsPage({ user: initialUser }: { user: any }) {
  const { currentClient } = useClient();
  const [user, setUser] = useState<any>(initialUser);
  const [activeTab, setActiveTab] = useState<'history' | 'generate' | 'analytics'>('analytics');
  const [reports, setReports] = useState<Report[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Modals
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [isGenModalOpen, setIsGenModalOpen] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '', role: 'technical' });
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddRecipient = async () => {
    if (!currentClient || !newRecipient.name || !newRecipient.email) return;
    const { data, error } = await supabase
      .from('report_recipients')
      .insert({
        client_id: currentClient.id,
        ...newRecipient
      })
      .select()
      .single();
    
    if (!error) {
      setRecipients([...recipients, data]);
      setIsRecipientModalOpen(false);
      setNewRecipient({ name: '', email: '', role: 'technical' });
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    const { error } = await supabase
      .from('report_recipients')
      .delete()
      .eq('id', id);
    if (!error) {
      setRecipients(recipients.filter(r => r.id !== id));
    }
  };

  const handleDeleteReport = async (id: string) => {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);
      
    if (!error) {
      setReports(reports.filter(r => r.id !== id));
      showToast('Report deleted successfully', 'success');
    } else {
      console.error('Error deleting report:', error);
      showToast('Failed to delete report', 'error');
    }
    setReportToDelete(null);
  };
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [genMode, setGenMode] = useState<'ai' | 'manual'>('ai');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const AI_LIMIT = 5;
  const [escalatedAlerts, setEscalatedAlerts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [severityPieData, setSeverityPieData] = useState<any[]>([]);
  const [topRulesData, setTopRulesData] = useState<any[]>([]);
  const [agentBarData, setAgentBarData] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (currentClient) {
        fetchReports();
        fetchRecipients();
        fetchEscalatedAlerts();
        fetchAgents();
        fetchAnalytics();
        fetchDailyUsage();
      }
    };
    init();
  }, [currentClient]);

  const fetchDailyUsage = async () => {
    if (!currentClient) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count, error } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', currentClient.id)
      .gte('created_at', today.toISOString());
      
    if (!error) {
      setAiUsageCount(count || 0);
    }
  };

  const fetchReports = async () => {
    if (!currentClient) return;
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', currentClient.id)
      .order('created_at', { ascending: false });
    
    const fetchedReports = data || [];
    setReports(fetchedReports);
    setLoading(false);

    // Check for navigation data
    const navDataStr = window.sessionStorage.getItem('nav_data');
    if (navDataStr) {
      try {
        const navData = JSON.parse(navDataStr);
        if (navData.openReportId) {
          const report = fetchedReports.find(r => r.id === navData.openReportId);
          if (report) {
            setSelectedReport(report);
            setEditContent(report.content);
            setEditTitle(report.title);
            setIsViewModalOpen(true);
          }
        }
        window.sessionStorage.removeItem('nav_data');
      } catch (e) {
        console.error('Failed to parse nav_data:', e);
      }
    }
  };

  const fetchRecipients = async () => {
    if (!currentClient) return;
    const { data } = await supabase
      .from('report_recipients')
      .select('*')
      .eq('client_id', currentClient.id);
    setRecipients(data || []);
  };

  const fetchEscalatedAlerts = async () => {
    if (!currentClient) return;
    const { data } = await supabase
      .from('alerts')
      .select('id, description, severity, timestamp, source_ip, agent_name')
      .eq('client_id', currentClient.id)
      .eq('status', 'Escalated') 
      .order('timestamp', { ascending: false });
    setEscalatedAlerts(data || []);
  };

  const fetchAgents = async () => {
    if (!currentClient) return;
    const { data } = await supabase
      .from('agents')
      .select('name')
      .eq('client_id', currentClient.id);
    setAgents(data || []);
  };

  const fetchAnalytics = async () => {
    if (!currentClient) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: alertData } = await supabase
      .from('alerts')
      .select('severity, timestamp, agent_name, rule_id, description, source_ip')
      .eq('client_id', currentClient.id)
      .gte('timestamp', sevenDaysAgo)
      .order('timestamp', { ascending: true });

    if (!alertData) return;

    // Process Day Data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts: any = {};
    days.forEach(d => dayCounts[d] = 0);
    alertData.forEach(a => {
      const d = new Date(a.timestamp).getDay();
      dayCounts[days[d]]++;
    });
    setAnalyticsData(days.map(d => ({ name: d, value: dayCounts[d] })));

    // Process Severity Data
    const sevCounts: any = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    alertData.forEach(a => {
      const s = a.severity?.toUpperCase();
      if (sevCounts[s] !== undefined) sevCounts[s]++;
    });
    setSeverityPieData([
      { name: 'Critical', value: sevCounts.CRITICAL, color: '#ef4444' },
      { name: 'High', value: sevCounts.HIGH, color: '#f97316' },
      { name: 'Medium', value: sevCounts.MEDIUM, color: '#3b82f6' },
      { name: 'Low', value: sevCounts.LOW, color: '#737373' },
    ]);

    // Process Top Rules
    const ruleMap: any = {};
    alertData.forEach(a => {
      ruleMap[a.description] = (ruleMap[a.description] || 0) + 1;
    });
    const sortedRules = Object.entries(ruleMap)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name: name.length > 30 ? name.substring(0, 30) + '...' : name, value }));
    setTopRulesData(sortedRules);

    // Process Agent Data
    const agentMap: any = {};
    alertData.forEach(a => {
      const name = a.agent_name || 'Unknown';
      agentMap[name] = (agentMap[name] || 0) + 1;
    });
    setAgentBarData(Object.entries(agentMap).map(([name, value]) => ({ name, value })));
  };

  const handleGenerateReport = async (type: string, params: any, isManual: boolean = false) => {
    if (!currentClient || !user) return;
    
    if (!isManual && aiUsageCount >= AI_LIMIT) {
      showToast("AI Generation limit reached. Please upgrade to Pro or use the 'Write Manually' option.", 'error');
      return;
    }

    setIsGenerating(true);
    try {
      let content = {};
      
      if (isManual) {
        // Prepare manual content with placeholders
        if (type === 'incident_report') {
          content = {
            executive_summary: "[Enter Executive Summary Here]",
            incident_details: {
              alert_id: params.alert?.id || "N/A",
              title: params.alert?.description || "N/A",
              severity: params.alert?.severity || "N/A",
              timestamp: params.alert?.timestamp || new Date().toISOString(),
              agent: params.agent || params.alert?.agent_name || "N/A",
              rule_id: params.alert?.rule_id || "N/A",
              source_ip: params.alert?.source_ip || "N/A"
            },
            attack_analysis: {
              description: "[Describe the attack here]",
              attack_chain: ["[Step 1]", "[Step 2]"],
              mitre_techniques: ["[Technique 1]"]
            },
            ioc_analysis: {
              iocs: [{type: "IP", value: params.alert?.source_ip || "", verdict: "Suspicious", source: "SOC Analysis"}],
              verdict: "Malicious",
              confidence: 80
            },
            impact_assessment: {
              affected_systems: ["[System 1]"],
              data_at_risk: "[Describe data at risk]",
              business_impact: "[Describe business impact]",
              severity_justification: "[Why is this severity assigned?]"
            },
            recommendations: {
              immediate: ["[Action 1]"],
              short_term: ["[Action 2]"],
              long_term: ["[Action 3]"]
            },
            conclusion: "[Final conclusion]"
          };
        } else if (type === 'weekly_summary') {
          content = {
            overview: {
              total_alerts: analyticsData.reduce((acc, curr) => acc + curr.value, 0),
              critical_count: severityPieData.find(d => d.name === 'CRITICAL')?.value || 0,
              high_count: severityPieData.find(d => d.name === 'HIGH')?.value || 0,
              medium_count: severityPieData.find(d => d.name === 'MEDIUM')?.value || 0,
              low_count: severityPieData.find(d => d.name === 'LOW')?.value || 0,
              resolved_count: 0,
              open_count: 0,
              trend_vs_last_week: "Stable"
            },
            top_threats: [],
            agent_summary: [],
            attack_origins: [],
            key_findings: ["[Finding 1]"],
            ai_insights: "Manual report - no AI insights generated.",
            recommendations: {
              immediate: ["[Action 1]"],
              strategic: ["[Action 2]"]
            },
            executive_summary: "[Enter Executive Summary Here]"
          };
        } else {
          content = {
            risk_posture: "[Describe Risk Posture]",
            business_impact: "[Describe Business Impact]",
            strategic_recommendations: ["[Recommendation 1]"],
            key_metrics: {
              total_incidents: analyticsData.reduce((acc, curr) => acc + curr.value, 0),
              critical_incidents: severityPieData.find(d => d.name === 'CRITICAL')?.value || 0,
              avg_resolution_time: "N/A"
            },
            executive_summary: "[Enter Executive Summary Here]",
            conclusion: "[Final Conclusion]"
          };
        }
      } else {
        content = await generateStructuredSOCReport({
          type: type as any,
          alertData: params.alert,
          statsData: {
            totalAlerts: analyticsData.reduce((acc, curr) => acc + curr.value, 0),
            severityCounts: severityPieData,
            weeklyTrends: analyticsData
          },
          analystName: user.email
        });
        setAiUsageCount(prev => prev + 1);
      }

      const { data, error } = await supabase
        .from('reports')
        .insert({
          client_id: currentClient.id,
          title: params.title,
          type: type,
          content: content,
          status: 'draft',
          generated_by: user.email,
          alert_id: params.alert?.id,
          agent_name: params.agent,
          date_from: params.dateFrom,
          date_to: params.dateTo
        })
        .select()
        .single();

      if (error) throw error;

      await fetchDailyUsage();
      setReports([data, ...reports]);
      setSelectedReport(data);
      setEditContent(data.content);
      setEditTitle(data.title);
      setIsViewModalOpen(true);
      setIsGenModalOpen(null);
    } catch (err) {
      console.error(err);
      showToast("Report Generation failed. You can still create reports manually.", 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToWord = async (report: Report) => {
    try {
      const clientName = currentClient?.name || 'Unknown Client';
      
      if (report.type === 'incident_report') {
        await downloadIncidentReport(report, clientName);
      } else if (report.type === 'weekly_summary') {
        await downloadWeeklyReport(report, clientName);
      } else if (report.type === 'executive') {
        await downloadExecutiveReport(report, clientName);
      } else {
        throw new Error('No template mapped for this report type');
      }
      
      showToast('Word document generated successfully', 'success');
    } catch (error) {
      console.error('Word Export Error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate Word document', 'error');
      
      // Fallback to basic HTML export if template fails
      const generateReportHTML = (r: Report) => {
        const content = r.content;
        return `
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <h1>${r.title}</h1>
              <p><strong>Type:</strong> ${r.type}</p>
              <p><strong>Status:</strong> ${r.status}</p>
              <p><strong>Generated By:</strong> ${r.generated_by}</p>
              <p><strong>Date:</strong> ${new Date(r.created_at).toLocaleString()}</p>
              <hr/>
              <h2>Executive Summary</h2>
              <p>${content?.executive_summary || content?.overview?.executive_summary || ""}</p>
              <h2>Conclusion</h2>
              <p>${content?.conclusion || ""}</p>
            </body>
          </html>
        `;
      };

      const htmlContent = generateReportHTML(report);
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const generateSectionsHTML = (report: any, content: any) => {
    const safeStr = (str: any) => str ? String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'N/A';
    const safeList = (arr: any[]) => arr && arr.length > 0 ? `<ul>${arr.map(item => `<li>${safeStr(item)}</li>`).join('')}</ul>` : '<p class="body-text">None</p>';

    if (report.type !== 'incident_report') {
      return `
        <div class="section-block">
          <div class="section-header">
            <span class="section-num">01</span>
            <h2 class="section-title">EXECUTIVE SUMMARY</h2>
          </div>
          <div class="highlight-box">
            <p>${safeStr(content?.executive_summary || content?.overview?.executive_summary)}</p>
          </div>
        </div>

        <div class="section-block">
          <div class="section-header">
            <span class="section-num">02</span>
            <h2 class="section-title">SECURITY OVERVIEW</h2>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 8px; font-weight: 700; color: #737373; text-transform: uppercase; margin-bottom: 4px;">Total Alerts</p>
              <p style="font-size: 16px; font-weight: 900; color: #2563eb; margin: 0;">${content?.overview?.total_alerts || 0}</p>
            </div>
            <div style="background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 8px; font-weight: 700; color: #737373; text-transform: uppercase; margin-bottom: 4px;">Critical</p>
              <p style="font-size: 16px; font-weight: 900; color: #dc2626; margin: 0;">${content?.overview?.critical_count || 0}</p>
            </div>
            <div style="background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 8px; font-weight: 700; color: #737373; text-transform: uppercase; margin-bottom: 4px;">High</p>
              <p style="font-size: 16px; font-weight: 900; color: #ea580c; margin: 0;">${content?.overview?.high_count || 0}</p>
            </div>
            <div style="background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 8px; font-weight: 700; color: #737373; text-transform: uppercase; margin-bottom: 4px;">Resolved</p>
              <p style="font-size: 16px; font-weight: 900; color: #16a34a; margin: 0;">${content?.overview?.resolved_count || 0}</p>
            </div>
          </div>
        </div>

        <div class="section-block">
          <div class="section-header">
            <span class="section-num">03</span>
            <h2 class="section-title">${report.type === 'weekly_summary' ? 'AI INSIGHTS' : 'BUSINESS IMPACT ANALYSIS'}</h2>
          </div>
          <div style="background: #f0f7ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px;">
            <p class="body-text" style="font-style: italic; color: #1e40af; margin: 0;">${safeStr(report.type === 'weekly_summary' ? content.ai_insights : content.business_impact)}</p>
          </div>
        </div>

        <div class="section-block">
          <div class="section-header">
            <span class="section-num">04</span>
            <h2 class="section-title">${report.type === 'weekly_summary' ? 'TOP THREATS DETECTED' : 'NOTABLE SECURITY INCIDENTS'}</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>${report.type === 'weekly_summary' ? 'Threat / Rule' : 'Date'}</th>
                <th>${report.type === 'weekly_summary' ? 'Count' : 'Description'}</th>
                <th>Severity</th>
                <th>${report.type === 'weekly_summary' ? 'Recommendation' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${(report.type === 'weekly_summary' ? (content.top_threats || []) : (content.notable_incidents || [])).map((item: any) => `
                <tr>
                  <td style="font-weight: 700; color: #171717;">${safeStr(report.type === 'weekly_summary' ? (item.rule_description || item.threat) : (item.date || item.timestamp))}</td>
                  <td style="color: #404040;">${safeStr(report.type === 'weekly_summary' ? item.count : item.description)}</td>
                  <td><span style="font-weight: 900; color: ${item.severity === 'Critical' ? '#dc2626' : item.severity === 'High' ? '#ea580c' : '#737373'}; text-transform: uppercase; font-size: 8px;">${safeStr(item.severity)}</span></td>
                  <td style="font-style: italic; color: #737373;">${safeStr(report.type === 'weekly_summary' ? item.recommendation : item.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${report.type === 'weekly_summary' ? `
        <div class="section-block">
          <div class="section-header">
            <span class="section-num">05</span>
            <h2 class="section-title">OPERATIONAL INTELLIGENCE</h2>
          </div>
          <p class="sub-title">Agent Activity Summary</p>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th style="text-align: center;">Alerts</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${(content.agent_summary || []).map((agent: any) => `
                <tr>
                  <td style="font-weight: 700; color: #171717;">${safeStr(agent.agent_name)}</td>
                  <td style="text-align: center; color: #404040;">${safeStr(agent.alert_count)}</td>
                  <td><span style="font-weight: 900; color: ${agent.risk_level === 'High' ? '#dc2626' : '#737373'}; text-transform: uppercase; font-size: 8px;">${safeStr(agent.risk_level)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="sub-title" style="margin-top: 16px;">Key Operational Findings</p>
          ${safeList(content.key_findings)}
        </div>
        ` : ''}

        <div class="section-block">
          <div class="section-header">
            <span class="section-num">06</span>
            <h2 class="section-title">RECOMMENDATIONS</h2>
          </div>
          <p class="sub-title" style="color: #dc2626;">Immediate Actions (P0 — DO NOW)</p>
          ${safeList(content?.recommendations?.immediate)}
          <p class="sub-title" style="color: #ea580c; margin-top: 16px;">Short-Term Actions (24—48 Hours)</p>
          ${safeList(content?.recommendations?.short_term)}
          <p class="sub-title" style="color: #2563eb; margin-top: 16px;">Long-Term / Strategic</p>
          ${safeList(content?.recommendations?.long_term)}
        </div>

        <div class="section-block">
          <div class="section-header">
            <span class="section-num">07</span>
            <h2 class="section-title">CONCLUSION</h2>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px;">
            <p class="body-text" style="font-weight: 700; color: #2563eb; margin: 0; font-style: italic;">${safeStr(content?.conclusion)}</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="section-block">
        <div class="section-header">
          <span class="section-num">01</span>
          <h2 class="section-title">EXECUTIVE SUMMARY</h2>
        </div>
        <div class="highlight-box">
          <p>${safeStr(content?.executive_summary)}</p>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">02</span>
          <h2 class="section-title">INCIDENT DETAILS</h2>
        </div>
        <table>
          <tr><td class="td-label">Alert ID</td><td class="td-value">${safeStr(content?.incident_details?.alert_id)}</td></tr>
          <tr><td class="td-label">Severity</td><td class="td-value-red">${safeStr(content?.incident_details?.severity)}</td></tr>
          <tr><td class="td-label">Event Timestamp</td><td class="td-value">${safeStr(content?.incident_details?.timestamp)}</td></tr>
          <tr><td class="td-label">Agent Name</td><td class="td-value">${safeStr(content?.incident_details?.agent)}</td></tr>
          <tr><td class="td-label">Source IP</td><td class="td-value">${safeStr(content?.incident_details?.source_ip)}</td></tr>
          <tr><td class="td-label">Destination IP</td><td class="td-value">${safeStr(content?.incident_details?.destination_ip || 'N/A')}</td></tr>
          <tr><td class="td-label">Priority</td><td class="td-value">P1</td></tr>
          <tr><td class="td-label">Assigned To</td><td class="td-value">AI Analyst</td></tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">03</span>
          <h2 class="section-title">ATTACK ANALYSIS</h2>
        </div>
        <p class="sub-title">Attack Type: <span style="color: #2563eb;">${safeStr(content?.attack_analysis?.attack_type || 'Malicious Activity')}</span></p>
        <p class="sub-title">Technical Description</p>
        <p class="body-text">${safeStr(content?.attack_analysis?.attack_description || content?.attack_analysis?.description || 'No description provided.')}</p>
        <p class="sub-title">Attack Chain</p>
        ${safeList(content?.attack_analysis?.attack_chain)}
        <p class="sub-title">MITRE ATT&CK Techniques</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
          ${(content?.attack_analysis?.mitre_techniques || []).map((t: string) => `<span style="background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 4px; padding: 4px 8px; font-size: 9px; font-weight: 700; color: #737373;">${safeStr(t)}</span>`).join('')}
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">04</span>
          <h2 class="section-title">IOC ANALYSIS & THREAT INTELLIGENCE</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>IOC Type</th>
              <th>Value</th>
              <th>Verdict</th>
              <th>Threat Score</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${(content?.ioc_analysis?.iocs || []).map((ioc: any) => `
              <tr>
                <td style="font-weight: 700; color: #737373;">${safeStr(ioc.type)}</td>
                <td style="font-weight: 700; color: #2563eb;">${safeStr(ioc.value)}</td>
                <td style="font-weight: 900; color: ${ioc.verdict?.toLowerCase() === 'malicious' ? '#dc2626' : '#d97706'}; text-transform: uppercase; font-size: 9px;">${safeStr(ioc.verdict)}</td>
                <td style="font-weight: 700; color: #171717;">${safeStr(content?.ioc_analysis?.confidence || '85')}/100</td>
                <td style="font-style: italic; color: #a3a3a3;">${safeStr(ioc.source || 'Internal Alert Logs')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">05</span>
          <h2 class="section-title">IMPACT ASSESSMENT</h2>
        </div>
        <table>
          <tr><td class="td-label">Affected Systems</td><td class="td-value">${safeList(content?.impact_assessment?.affected_systems)}</td></tr>
          <tr><td class="td-label">Data at Risk</td><td class="td-value">${safeStr(content?.impact_assessment?.data_at_risk)}</td></tr>
          <tr><td class="td-label">Business Impact</td><td class="td-value">${safeStr(content?.impact_assessment?.business_impact)}</td></tr>
          <tr><td class="td-label">Containment Status</td><td class="td-value">Contained</td></tr>
          <tr><td class="td-label">True Positive</td><td class="td-value">Yes</td></tr>
          <tr><td class="td-label">Confidence Level</td><td class="td-value">${safeStr(content?.ioc_analysis?.confidence || '95')}%</td></tr>
        </table>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">06</span>
          <h2 class="section-title">RECOMMENDATIONS</h2>
        </div>
        <p class="sub-title" style="color: #dc2626;">Immediate Actions (P0 — DO NOW)</p>
        ${safeList(content?.recommendations?.immediate)}
        <p class="sub-title" style="color: #d97706; margin-top: 16px;">Short-Term Actions (24—48 Hours)</p>
        ${safeList(content?.recommendations?.short_term)}
        <p class="sub-title" style="color: #2563eb; margin-top: 16px;">Long-Term / Strategic</p>
        ${safeList(content?.recommendations?.long_term)}
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">07</span>
          <h2 class="section-title">ANALYST NOTES</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <p class="body-text" style="font-style: italic; color: #2563eb; margin: 0;">${safeStr(content?.analyst_notes || 'No additional analyst notes provided.')}</p>
        </div>
      </div>

      <div class="section-block">
        <div class="section-header">
          <span class="section-num">08</span>
          <h2 class="section-title">CONCLUSION</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p class="body-text" style="font-weight: 700; color: #2563eb; margin: 0; font-style: italic;">${safeStr(content?.conclusion)}</p>
        </div>
        
        <div style="margin-top: 40px; border-top: 1px solid #e5e5e5; padding-top: 24px; display: flex; justify-content: space-between;">
          <div>
            <p style="font-size: 10px; font-weight: 700; color: #a3a3a3; text-transform: uppercase; margin: 0 0 4px 0;">Report Generated By</p>
            <p style="font-size: 14px; font-weight: 900; color: #171717; margin: 0;">KastronNet AI Analyst</p>
            <p style="font-size: 10px; color: #737373; margin: 0;">Automated Security Operations</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: 700; color: #a3a3a3; text-transform: uppercase; margin: 0 0 4px 0;">Date & Time</p>
            <p style="font-size: 14px; font-weight: 900; color: #171717; margin: 0;">${new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;
  };

  const handleDownloadPDF = () => {
    if (!selectedReport) {
      showToast('Report content not found', 'error');
      return;
    }
    
    showToast('Generating PDF...', 'info');

    const title = editTitle;
    const clientName = currentClient?.name || 'N/A';
    const date = new Date(selectedReport.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const shortDate = new Date(selectedReport.created_at).toLocaleDateString();
    const reportType = selectedReport.type === 'incident_report' ? 'INCIDENT REPORT' : 
                       selectedReport.type === 'weekly_summary' ? 'WEEKLY SUMMARY' : 'EXECUTIVE REPORT';
    const reportSub = selectedReport.type === 'incident_report' ? 'Incident Analysis & Remediation' : 
                      selectedReport.type === 'weekly_summary' ? 'Operational Intelligence & Metrics' : 'Strategic Risk & Compliance Overview';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      background: white;
      color: #171717;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4;
      margin: 16mm 16mm 18mm 16mm;
    }

    .page {
      width: 100%;
      min-height: 257mm;
      max-height: 257mm;
      overflow: hidden;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      position: relative;
      box-sizing: border-box;
    }

    .page-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .section-block {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 24px;
    }

    /* Typography */
    .section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #dc2626; padding-bottom: 8px; }
    .section-num { font-size: 20px; font-weight: 900; color: #dc2626; }
    .section-title { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #171717; letter-spacing: 0.05em; margin: 0; }
    .body-text { font-size: 12px; line-height: 1.55; color: #404040; margin: 0 0 12px 0; }
    .sub-title { font-size: 10px; font-weight: 700; color: #737373; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px 0; }
    
    /* Header/Footer */
    .footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .footer-left { color: #a3a3a3; }
    .footer-right { color: #dc2626; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f5f5f5;
    }
    .header-logo { font-size: 18px; font-weight: 900; letter-spacing: -0.05em; }
    .header-logo span { color: #dc2626; }
    .header-meta { font-size: 8px; font-weight: 700; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    th { background: #171717; color: white; padding: 8px 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #404040; }
    tr:last-child td { border-bottom: none; }
    .td-label { font-weight: 700; color: #737373; width: 30%; border-right: 1px solid #e5e5e5; background: #f9fafb; text-transform: uppercase; letter-spacing: 0.05em; }
    .td-value { font-weight: 700; color: #2563eb; white-space: pre-wrap; word-break: break-word; vertical-align: top; }
    .td-value-red { font-weight: 700; color: #dc2626; text-transform: uppercase; }

    /* Cover */
    .cover-block { display: flex; margin-bottom: 40px; }
    .cover-left { flex: 1; background: #1a1f2c; padding: 48px; }
    .cover-right { width: 33%; background: #c23e2b; padding: 48px; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; text-align: right; }
    .cover-title { font-size: 32px; font-weight: 900; color: #171717; margin: 0 0 8px 0; letter-spacing: -0.02em; }
    .cover-subtitle { font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 40px 0; }
    
    /* Lists */
    ul { margin: 0 0 12px 0; padding-left: 16px; }
    li { font-size: 12px; line-height: 1.55; color: #404040; margin-bottom: 4px; }
    
    /* Truncation */
    .truncate-msg { font-size: 10px; font-style: italic; color: #dc2626; margin-top: 8px; font-weight: bold; }
    
    /* Highlight Box */
    .highlight-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .highlight-box p { margin: 0; color: #991b1b; font-style: italic; font-size: 12px; line-height: 1.55; }
  </style>
</head>
<body>

  <div id="pages-container">
    <!-- Page 1: Cover -->
    <div class="page">
      <div class="header" style="border: none; margin-bottom: 40px;">
        <div class="header-logo">KASTRON<span>SEC</span></div>
        <div class="header-meta">${reportType} | CONFIDENTIAL</div>
      </div>
      
      <div class="page-content">
        <div class="cover-block">
          <div class="cover-left">
            <div style="font-size: 48px; font-weight: 900; color: white; line-height: 1; letter-spacing: -0.05em;">KASTRON</div>
            <div style="font-size: 48px; font-weight: 900; color: #dc2626; line-height: 1; margin-bottom: 24px; letter-spacing: -0.05em;">SEC</div>
            <div style="color: #a3a3a3; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; font-size: 10px;">Security Operations Center</div>
          </div>
          <div class="cover-right">
            <div style="color: white; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; margin-bottom: 4px;">${reportType}</div>
            <div style="color: rgba(255,255,255,0.6); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 8px;">CONFIDENTIAL</div>
          </div>
        </div>
        
        <h1 class="cover-title">${selectedReport.type === 'incident_report' ? 'Security Incident Report' : selectedReport.type === 'weekly_summary' ? 'Weekly Security Summary' : 'Executive Security Briefing'}</h1>
        <h2 class="cover-subtitle">${reportSub}</h2>
        
        <table>
          <tr><td class="td-label">Client Name</td><td class="td-value">${clientName}</td></tr>
          <tr><td class="td-label">Report Title</td><td class="td-value">${title}</td></tr>
          <tr><td class="td-label">Report ID</td><td class="td-value">${selectedReport.id.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td class="td-label">Generated By</td><td class="td-value">KastronNet AI Analyst</td></tr>
          <tr><td class="td-label">Generated Date</td><td class="td-value">${date}</td></tr>
          <tr><td class="td-label">Classification</td><td class="td-value">CONFIDENTIAL — For Authorized Personnel Only</td></tr>
        </table>
      </div>
      
      <div class="footer">
        <div class="footer-left">KASTRONSEC — SECURITY OPERATIONS CENTER</div>
        <div class="footer-right">CONFIDENTIAL</div>
      </div>
    </div>
  </div>

  <div id="source-sections" style="display: none;">
    ${generateSectionsHTML(selectedReport, editContent)}
  </div>

  <script>
    const source = document.getElementById('source-sections');
    const container = document.getElementById('pages-container');
    const sections = Array.from(source.children);
    
    function createPage() {
      const page = document.createElement('div');
      page.className = 'page';
      
      const header = document.createElement('div');
      header.className = 'header';
      header.innerHTML = '<div class="header-logo">KASTRON<span>SEC</span></div><div class="header-meta">${title.replace(/'/g, "\\'")} | ${shortDate}</div>';
      
      const content = document.createElement('div');
      content.className = 'page-content';
      
      const footer = document.createElement('div');
      footer.className = 'footer';
      footer.innerHTML = '<div class="footer-left">KASTRONSEC — SECURITY OPERATIONS CENTER</div><div class="footer-right">CONFIDENTIAL</div>';
      
      page.appendChild(header);
      page.appendChild(content);
      page.appendChild(footer);
      
      container.appendChild(page);
      return content;
    }
    
    let currentContent = createPage();
    let sectionsOnPage = 0;
    
    sections.forEach(sec => {
      currentContent.appendChild(sec);
      sectionsOnPage++;
      
      // Check if it overflows or exceeds max sections
      if (currentContent.scrollHeight > currentContent.clientHeight || sectionsOnPage > 2) {
        currentContent.removeChild(sec);
        
        currentContent = createPage();
        currentContent.appendChild(sec);
        sectionsOnPage = 1;
        
        // Truncate if it STILL overflows on a new page
        if (currentContent.scrollHeight > currentContent.clientHeight) {
           while(currentContent.scrollHeight > currentContent.clientHeight && sec.lastChild) {
              sec.removeChild(sec.lastChild);
           }
           const msg = document.createElement('div');
           msg.className = 'truncate-msg';
           msg.innerText = '[View full details in KastronNet platform]';
           sec.appendChild(msg);
           
           while(currentContent.scrollHeight > currentContent.clientHeight && sec.childNodes.length > 1) {
              sec.removeChild(sec.childNodes[sec.childNodes.length - 2]);
           }
        }
      }
    });
    
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 1000);
    };
  </script>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      showToast('Please allow popups to generate PDF', 'error');
    }
  };

  const handleSaveReport = async () => {
    if (!selectedReport) return;
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          title: editTitle,
          content: editContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReport.id);
      
      if (!error) {
        setReports(reports.map(r => r.id === selectedReport.id ? { ...r, title: editTitle, content: editContent } : r));
        setSelectedReport({ ...selectedReport, title: editTitle, content: editContent });
        setIsEditing(false);
        showToast('Report saved successfully', 'success');
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Save Error:', error);
      showToast('Failed to save report changes', 'error');
    }
  };

  const filteredReports = reports.filter(r => {
    if (filter === 'all') return true;
    if (['incident_report', 'weekly_summary', 'executive'].includes(filter)) return r.type === filter;
    return r.status === filter;
  });

  const stats = {
    total: reports.length,
    thisWeek: reports.filter(r => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    sent: reports.filter(r => r.status === 'sent').length,
    draft: reports.filter(r => r.status === 'draft').length
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-neutral-950">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Reports" value={stats.total} subValue="All Time" icon={FileText} color="text-blue-500" />
        <StatCard label="This Week" value={stats.thisWeek} subValue="New" icon={TrendingUp} color="text-green-500" />
        <StatCard label="Sent Reports" value={stats.sent} subValue="Delivered" icon={CheckCircle2} color="text-purple-500" />
        <StatCard label="Draft Reports" value={stats.draft} subValue="Pending" icon={Clock} color="text-orange-500" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-neutral-800">
        {[
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'generate', label: 'Generate Report', icon: Zap },
          { id: 'history', label: 'Reports History', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 pb-4 text-xs font-bold uppercase tracking-widest transition-all relative",
              activeTab === tab.id ? "text-white" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'analytics' && (
          <motion.div 
            key="analytics"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-black border border-neutral-800 p-6 rounded-2xl h-80 flex flex-col">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-6">Alerts by Day</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData}>
                      <CartesianGrid vertical={false} stroke="#262626" strokeDasharray="3 3" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '8px', fontSize: '10px' }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-black border border-neutral-800 p-6 rounded-2xl h-80 flex flex-col">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-6">Alerts by Severity</h4>
                <div className="flex-1 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={severityPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {severityPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '8px', fontSize: '10px' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-black border border-neutral-800 p-6 rounded-2xl h-80 flex flex-col">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-6">Top 5 Triggered Rules</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRulesData} layout="vertical">
                      <CartesianGrid horizontal={false} stroke="#262626" strokeDasharray="3 3" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} width={120} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '8px', fontSize: '10px' }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-black border border-neutral-800 p-6 rounded-2xl h-80 flex flex-col">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-6">Alerts by Agent</h4>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agentBarData}>
                      <CartesianGrid vertical={false} stroke="#262626" strokeDasharray="3 3" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #262626', borderRadius: '8px', fontSize: '10px' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'generate' && (
          <motion.div 
            key="generate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { id: 'incident_report', title: 'Incident Report', icon: AlertTriangle, color: 'text-red-500', desc: 'Generate a detailed incident report from an escalated alert. Includes IOC analysis, attack chain, MITRE ATT&CK mapping and recommendations.' },
              { id: 'weekly_summary', title: 'Weekly Summary', icon: BarChart2, color: 'text-blue-500', desc: 'Generate a weekly security summary with alert trends, top threats, agent analysis and AI-powered insights for the past 7 days.' },
              { id: 'executive', title: 'Executive Report', icon: FileText, color: 'text-purple-500', desc: 'Generate a non-technical executive briefing for management. Includes risk posture, business impact and strategic recommendations.' }
            ].map(card => (
              <div key={card.id} className="bg-black border border-neutral-800 p-8 rounded-2xl flex flex-col h-full group hover:border-neutral-700 transition-all">
                <div className={cn("w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center mb-6", card.color)}>
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{card.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed mb-8 flex-1">{card.desc}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { setGenMode('manual'); setIsGenModalOpen(card.id); }}
                    className="py-3 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest border border-neutral-800 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Manual
                  </button>
                  <button 
                    onClick={() => { 
                      if (aiUsageCount >= AI_LIMIT) {
                        setIsUpgradeModalOpen(true);
                      } else {
                        setGenMode('ai'); 
                        setIsGenModalOpen(card.id); 
                      }
                    }}
                    className={cn(
                      "py-3 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2",
                      aiUsageCount >= AI_LIMIT 
                        ? "bg-neutral-800 text-neutral-500 border border-neutral-800" 
                        : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    AI Gen
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {['all', 'incident_report', 'weekly_summary', 'executive', 'draft', 'sent'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all",
                      filter === f ? "bg-white text-black border-white" : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-700"
                    )}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <input 
                  type="text" 
                  placeholder="Search reports..."
                  className="bg-black border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-all w-64"
                />
              </div>
            </div>

            <div className="bg-black border border-neutral-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Title</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Generated By</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {loading ? (
                    <tr><td colSpan={6} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
                  ) : filteredReports.length === 0 ? (
                    <tr><td colSpan={6} className="p-12 text-center text-neutral-500 italic">No reports found.</td></tr>
                  ) : (
                    filteredReports.map(report => (
                      <tr key={report.id} className="group hover:bg-neutral-900/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-white text-xs">{report.title}</td>
                        <td className="px-6 py-4"><Badge variant={report.type}>{report.type}</Badge></td>
                        <td className="px-6 py-4"><Badge variant={report.status}>{report.status}</Badge></td>
                        <td className="px-6 py-4 text-xs text-neutral-400">{report.generated_by}</td>
                        <td className="px-6 py-4 text-xs text-neutral-500">{new Date(report.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setSelectedReport(report); setEditContent(report.content); setEditTitle(report.title); setIsViewModalOpen(true); }} className="p-2 hover:bg-blue-500/10 text-neutral-500 hover:text-blue-400 rounded-lg transition-all"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => exportToWord(report)} className="p-2 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-lg transition-all"><Download className="w-4 h-4" /></button>
                            <button onClick={() => setReportToDelete(report.id)} className="p-2 hover:bg-red-500/10 text-neutral-500 hover:text-red-400 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipients Section */}
      <div className="bg-black border border-neutral-800 p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Saved Recipients</h3>
            <p className="text-xs text-neutral-500 mt-1">Manage who receives security reports.</p>
          </div>
          <button 
            onClick={() => setIsRecipientModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-lg border border-neutral-800 transition-all uppercase tracking-widest"
          >
            <Plus className="w-3 h-3" /> Add Recipient
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {recipients.map(r => (
            <div key={r.id} className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 text-[10px] font-bold">
                {r.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[11px] font-bold text-white">{r.name}</p>
                <p className="text-[9px] text-neutral-500">{r.email}</p>
              </div>
              <button 
                onClick={() => handleDeleteRecipient(r.id)}
                className="p-1 text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Generation Modals */}
      <AnimatePresence>
        {isGenModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white tracking-tight">Generate {isGenModalOpen.replace('_', ' ')}</h3>
                <button onClick={() => setIsGenModalOpen(null)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Report Title</label>
                  <input 
                    type="text" 
                    defaultValue={`${isGenModalOpen.replace('_', ' ')} — ${new Date().toLocaleDateString()}`}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    id="gen-title"
                  />
                </div>
                {isGenModalOpen === 'incident_report' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Select Escalated Alert</label>
                    <div className="h-[92px] overflow-y-auto space-y-2 scrollbar-hide">
                      {escalatedAlerts.length === 0 ? (
                        <div className="p-4 bg-black/40 rounded-xl border border-neutral-800 text-center text-xs text-neutral-500 italic">
                          No escalated alerts found.
                        </div>
                      ) : (
                        escalatedAlerts.map(a => (
                          <button
                            key={a.id}
                            onClick={() => {
                              const select = document.getElementById('gen-alert') as HTMLSelectElement;
                              if (select) select.value = a.id;
                              // Trigger a re-render or state update if needed, but here we use DOM for simplicity in the existing pattern
                              const buttons = document.querySelectorAll('.alert-select-btn');
                              buttons.forEach(btn => btn.classList.remove('border-blue-500', 'bg-blue-500/10'));
                              const currentBtn = document.getElementById(`btn-${a.id}`);
                              if (currentBtn) currentBtn.classList.add('border-blue-500', 'bg-blue-500/10');
                            }}
                            id={`btn-${a.id}`}
                            className="alert-select-btn w-full text-left p-3 bg-black border border-neutral-800 rounded-xl hover:border-neutral-600 transition-all group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn(
                                "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                                a.severity === 'CRITICAL' ? "bg-red-500/10 text-red-500" :
                                a.severity === 'HIGH' ? "bg-orange-500/10 text-orange-500" :
                                "bg-blue-500/10 text-blue-500"
                              )}>
                                {a.severity}
                              </span>
                              <span className="text-[9px] text-neutral-500 font-mono">{new Date(a.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{a.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[9px] text-neutral-500 uppercase tracking-widest">IP: {a.source_ip || 'N/A'}</span>
                              <span className="text-[9px] text-neutral-500 uppercase tracking-widest">Agent: {a.agent_name || 'N/A'}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {/* Hidden select for the existing logic */}
                    <select className="hidden" id="gen-alert">
                      {escalatedAlerts.map(a => <option key={a.id} value={a.id}>{a.description}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Agent (Optional)</label>
                  <select className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" id="gen-agent">
                    <option value="">All Agents</option>
                    {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Additional Notes</label>
                  <textarea className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-24 resize-none" id="gen-notes" />
                </div>

                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-neutral-500 font-medium">Daily Usage: <span className={cn(aiUsageCount >= AI_LIMIT ? "text-red-500" : "text-blue-400")}>{aiUsageCount}/{AI_LIMIT}</span></span>
                    {aiUsageCount >= AI_LIMIT && (
                      <span className="text-[9px] text-red-500 font-bold animate-pulse">LIMIT REACHED</span>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      const title = (document.getElementById('gen-title') as HTMLInputElement).value;
                      const alertId = (document.getElementById('gen-alert') as HTMLSelectElement)?.value;
                      const agent = (document.getElementById('gen-agent') as HTMLSelectElement).value;
                      const alert = escalatedAlerts.find(a => a.id === alertId);
                      handleGenerateReport(isGenModalOpen, { title, alert, agent }, genMode === 'manual');
                    }}
                    disabled={isGenerating || (genMode === 'ai' && aiUsageCount >= AI_LIMIT)}
                    className={cn(
                      "w-full py-3 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest shadow-lg flex items-center justify-center gap-2",
                      genMode === 'ai' && aiUsageCount >= AI_LIMIT 
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700" 
                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                    )}
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (genMode === 'ai' ? <Zap className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />)}
                    {genMode === 'ai' ? (aiUsageCount >= AI_LIMIT ? "Upgrade to Pro" : "Generate with AI") : "Create Manual Report"}
                  </button>

                  {aiUsageCount >= AI_LIMIT && genMode === 'ai' && (
                    <p className="text-[9px] text-neutral-500 text-center leading-relaxed">
                      You've reached your free AI report limit. <br/>
                      <button onClick={() => setIsUpgradeModalOpen(true)} className="text-blue-400 hover:underline font-bold">Upgrade to Pro</button> for unlimited AI generation or use manual mode.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Viewer Modal */}
      <AnimatePresence>
        {isViewModalOpen && selectedReport && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-800 bg-black flex items-center justify-between no-print">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    {isEditing ? (
                      <input 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-transparent border-none text-lg font-bold text-white focus:outline-none p-0"
                      />
                    ) : (
                      <h3 className="text-lg font-bold text-white">{editTitle}</h3>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedReport.status}>{selectedReport.status}</Badge>
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        Created {new Date(selectedReport.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEditing ? (
                    <button onClick={handleSaveReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest">
                      <Check className="w-3.5 h-3.5" /> Save Changes
                    </button>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold rounded-lg border border-neutral-800 transition-all uppercase tracking-widest">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Report
                    </button>
                  )}
                  <button 
                    onClick={handleDownloadPDF} 
                    className="p-2 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-lg transition-all"
                    title="Download PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDownloadPDF} 
                    className="p-2 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-lg transition-all"
                    title="Print Report"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsEmailModalOpen(true)} className="p-2 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded-lg transition-all"><Mail className="w-4 h-4" /></button>
                  <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-red-500/10 text-neutral-500 hover:text-red-500 rounded-lg transition-all"><X className="w-5 h-5" /></button>
                </div>
              </div>              {/* Content */}
              <div className="flex-1 overflow-y-auto p-0 scrollbar-hide bg-neutral-100 no-print" id="report-viewer-container">
                <div className="max-w-[850px] mx-auto my-8 space-y-8 print:m-0 print:max-w-none" id="report-print-area">
                  
                  {/* --- PAGE 1: COVER PAGE --- */}
                  <div className="bg-white shadow-xl p-16 min-h-[1100px] flex flex-col justify-between relative overflow-hidden print:shadow-none print:m-0">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1">
                        <span className="text-xl font-black tracking-tighter text-neutral-900">KASTRON</span>
                        <span className="text-xl font-black tracking-tighter text-red-600">SEC</span>
                      </div>
                      <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                        {selectedReport.type === 'incident_report' ? 'INCIDENT REPORT' : 
                         selectedReport.type === 'weekly_summary' ? 'WEEKLY SUMMARY' : 'EXECUTIVE REPORT'} | CONFIDENTIAL
                      </div>
                    </div>

                    {/* Main Cover Content */}
                    <div className="flex flex-col items-center text-center">
                      <div className="w-full flex mb-16 shadow-2xl">
                        <div className="flex-1 bg-[#1a1f2c] p-12 text-left">
                          <h1 className="text-5xl font-black text-white mb-1 tracking-tighter">KASTRON</h1>
                          <h1 className="text-5xl font-black text-red-600 mb-6 tracking-tighter">SEC</h1>
                          <p className="text-neutral-400 font-bold uppercase tracking-[0.3em] text-[10px]">Security Operations Center</p>
                        </div>
                        <div className="w-1/3 bg-[#c23e2b] p-12 flex flex-col justify-center items-end text-right">
                          <p className="text-white font-black uppercase tracking-widest text-xs mb-1">
                            {selectedReport.type === 'incident_report' ? 'INCIDENT REPORT' : 
                             selectedReport.type === 'weekly_summary' ? 'WEEKLY SUMMARY' : 'EXECUTIVE REPORT'}
                          </p>
                          <p className="text-white/60 font-bold uppercase tracking-widest text-[8px]">CONFIDENTIAL</p>
                        </div>
                      </div>

                      <h2 className="text-4xl font-black text-neutral-900 mb-3 tracking-tight">
                        {selectedReport.type === 'incident_report' ? 'Security Incident Report' : 
                         selectedReport.type === 'weekly_summary' ? 'Weekly Security Summary' : 'Executive Security Briefing'}
                      </h2>
                      <h3 className="text-base font-bold text-red-600 uppercase tracking-[0.2em] mb-20">
                        {selectedReport.type === 'incident_report' ? 'Incident Analysis & Remediation' : 
                         selectedReport.type === 'weekly_summary' ? 'Operational Intelligence & Metrics' : 'Strategic Risk & Compliance Overview'}
                      </h3>

                      {/* Info Table */}
                      <div className="w-full max-w-xl border border-neutral-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                          <tbody className="divide-y divide-neutral-200">
                            {[
                              { label: 'Client Name', value: currentClient?.name || 'N/A' },
                              { 
                                label: 'Report Title', 
                                value: isEditing ? (
                                  <input 
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-blue-600 font-bold"
                                  />
                                ) : editTitle 
                              },
                              { label: 'Report ID', value: selectedReport.id.slice(0, 8).toUpperCase() },
                              { label: 'Generated By', value: 'KastronNet AI Analyst' },
                              { label: 'Generated Date', value: new Date(selectedReport.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) },
                              { label: 'Classification', value: 'CONFIDENTIAL — For Authorized Personnel Only' }
                            ].map((row, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                                <td className="px-6 py-3 font-bold text-neutral-500 w-1/3 border-r border-neutral-200 uppercase tracking-wider">{row.label}</td>
                                <td className="px-6 py-3 font-bold text-blue-600">{row.value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-6 border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>KastronSec — Security Operations Center</span>
                      <span className="text-red-600">CONFIDENTIAL</span>
                    </div>
                  </div>

                  {/* --- PAGE 2: SUMMARY & DETAILS --- */}
                  <div className="bg-white shadow-xl p-16 min-h-[1100px] flex flex-col print:shadow-none print:m-0">
                    {/* Header for content pages */}
                    <div className="flex justify-between items-start mb-12 border-b border-neutral-100 pb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-black tracking-tighter text-neutral-900">KASTRON</span>
                        <span className="text-lg font-black tracking-tighter text-red-600">SEC</span>
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                        {editTitle} | {new Date(selectedReport.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="space-y-12 flex-grow">
                      {/* 01 EXECUTIVE SUMMARY */}
                    <section className="space-y-4">
                      <div className="section-header">
                        <span className="section-num">01</span>
                        <h2 className="section-title">Executive Summary</h2>
                      </div>
                      
                      <div className="highlight-box">
                        {isEditing ? (
                          <textarea 
                            value={editContent?.executive_summary || editContent?.overview?.executive_summary || ""} 
                            onChange={(e) => {
                              const newContent = { ...editContent };
                              if (newContent.executive_summary !== undefined) newContent.executive_summary = e.target.value;
                              else if (newContent.overview) newContent.overview.executive_summary = e.target.value;
                              setEditContent(newContent);
                            }}
                            className="w-full bg-white border border-red-200 rounded-lg p-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px]"
                          />
                        ) : (
                          <p>
                            {editContent?.executive_summary || editContent?.overview?.executive_summary || "No summary available."}
                          </p>
                        )}
                      </div>
                    </section>

                    {/* 02 INCIDENT DETAILS / OVERVIEW */}
                    <section className="space-y-4">
                      <div className="section-header">
                        <span className="section-num">02</span>
                        <h2 className="section-title">
                          {selectedReport.type === 'incident_report' ? 'Incident Details' : 'Security Overview'}
                        </h2>
                      </div>

                      {selectedReport.type === 'incident_report' && editContent?.incident_details ? (
                        <table>
                          <tbody className="divide-y divide-neutral-200">
                            {[
                              { key: 'alert_id', label: 'Alert ID', value: editContent.incident_details.alert_id },
                              { key: 'severity', label: 'Severity', value: editContent.incident_details.severity, isRed: true },
                              { key: 'timestamp', label: 'Event Timestamp', value: editContent.incident_details.timestamp },
                              { key: 'agent', label: 'Agent Name', value: editContent.incident_details.agent },
                              { key: 'source_ip', label: 'Source IP', value: editContent.incident_details.source_ip || 'N/A' },
                              { key: 'dest_ip', label: 'Destination IP', value: editContent.incident_details.dest_ip || 'N/A' },
                              { key: 'priority', label: 'Priority', value: editContent.incident_details.priority || 'P1' },
                              { key: 'assigned_to', label: 'Assigned To', value: editContent.incident_details.assigned_to || 'AI Analyst' }
                            ].map((item, i) => (
                              <tr key={item.label}>
                                <td className="td-label">{item.label}</td>
                                <td className={cn("td-value", item.isRed && "td-value-red")}>
                                  {isEditing ? (
                                    ['agent', 'source_ip', 'dest_ip'].includes(item.key) ? (
                                      <input 
                                        value={item.value}
                                        onChange={(e) => {
                                          const newContent = { ...editContent };
                                          newContent.incident_details[item.key] = e.target.value;
                                          setEditContent(newContent);
                                        }}
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-blue-600"
                                      />
                                    ) : (
                                      <textarea 
                                        value={item.value}
                                        onChange={(e) => {
                                          const newContent = { ...editContent };
                                          newContent.incident_details[item.key] = e.target.value;
                                          setEditContent(newContent);
                                        }}
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-blue-600 resize-none min-h-[20px]"
                                        rows={1}
                                        onInput={(e: any) => {
                                          e.target.style.height = 'auto';
                                          e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                      />
                                    )
                                  ) : item.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {[
                            { key: 'total_alerts', label: 'Total Alerts', value: editContent?.overview?.total_alerts, color: 'text-blue-600' },
                            { key: 'critical_count', label: 'Critical', value: editContent?.overview?.critical_count, color: 'text-red-600' },
                            { key: 'high_count', label: 'High', value: editContent?.overview?.high_count, color: 'text-orange-600' },
                            { key: 'resolved_count', label: 'Resolved', value: editContent?.overview?.resolved_count, color: 'text-green-600' },
                            ...(selectedReport.type === 'executive' ? [{ key: 'overall_risk_level', label: 'Risk Level', value: editContent?.overall_risk_level || 'LOW', color: 'text-purple-600', isRoot: true }] : [])
                          ].map(stat => (
                            <div key={stat.label} className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-center">
                              <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                              {isEditing ? (
                                <input 
                                  type={stat.key === 'overall_risk_level' ? 'text' : 'number'}
                                  value={stat.value ?? (stat.key === 'overall_risk_level' ? 'LOW' : 0)}
                                  onChange={(e) => {
                                    const newContent = { ...editContent };
                                    if (stat.isRoot) {
                                      newContent[stat.key] = e.target.value;
                                    } else {
                                      if (!newContent.overview) newContent.overview = {};
                                      newContent.overview[stat.key] = parseInt(e.target.value) || 0;
                                    }
                                    setEditContent(newContent);
                                  }}
                                  className={cn("w-full bg-white border border-neutral-200 rounded text-center text-xl font-black focus:outline-none focus:ring-1 focus:ring-blue-500", stat.color)}
                                />
                              ) : (
                                <p className={cn("text-xl font-black", stat.color)}>{stat.value ?? (stat.key === 'overall_risk_level' ? 'LOW' : 0)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                    </div>

                    {/* Footer for content pages */}
                    <div className="pt-12 mt-auto border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>KastronSec — Security Operations Center</span>
                      <span className="text-red-600">CONFIDENTIAL</span>
                    </div>
                  </div>

                  {/* --- PAGE 3: ANALYSIS --- */}
                  <div className="bg-white shadow-xl p-16 min-h-[1100px] flex flex-col print:shadow-none print:m-0 html2pdf__page-break">
                    {/* Header for content pages */}
                    <div className="flex justify-between items-start mb-12 border-b border-neutral-100 pb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-black tracking-tighter text-neutral-900">KASTRON</span>
                        <span className="text-lg font-black tracking-tighter text-red-600">SEC</span>
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                        {editTitle} | {new Date(selectedReport.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-y-12 flex-grow">
                      {/* 03 AI INSIGHTS / BUSINESS IMPACT (Weekly/Executive) */}
                    {(selectedReport.type === 'weekly_summary' || selectedReport.type === 'executive') && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">03</span>
                          <h2 className="section-title">
                            {selectedReport.type === 'weekly_summary' ? 'AI Insights' : 'Business Impact Analysis'}
                          </h2>
                        </div>
                        <div className="p-6 bg-blue-50/30 border border-blue-100 rounded-lg">
                          {isEditing ? (
                            <textarea 
                              value={selectedReport.type === 'weekly_summary' ? editContent.ai_insights : editContent.business_impact || ""}
                              onChange={(e) => {
                                const newContent = { ...editContent };
                                if (selectedReport.type === 'weekly_summary') {
                                  newContent.ai_insights = e.target.value;
                                } else {
                                  newContent.business_impact = e.target.value;
                                }
                                setEditContent(newContent);
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                            />
                          ) : (
                            <p className="text-xs text-neutral-700 leading-relaxed italic break-words whitespace-pre-wrap">
                              {selectedReport.type === 'weekly_summary' ? editContent.ai_insights : (editContent.business_impact || 'No business impact analysis provided.')}
                            </p>
                          )}
                        </div>
                      </section>
                    )}

                    {/* 03 ATTACK ANALYSIS (Incident) */}
                    {selectedReport.type === 'incident_report' && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">03</span>
                          <h2 className="section-title">Attack Analysis</h2>
                        </div>

                        <div className="space-y-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider">Attack Type:</span>
                            {isEditing ? (
                              <input 
                                value={editContent?.attack_analysis?.attack_type || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  if (!newContent.attack_analysis) newContent.attack_analysis = {};
                                  newContent.attack_analysis.attack_type = e.target.value;
                                  setEditContent(newContent);
                                }}
                                className="bg-neutral-50 border border-neutral-200 rounded px-2 py-0.5 text-[11px] text-blue-600 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-blue-600">{editContent?.attack_analysis?.attack_type || 'Malicious Activity'}</span>
                            )}
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Technical Description</h4>
                            {isEditing ? (
                              <textarea 
                                value={editContent?.attack_analysis?.attack_description || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  if (!newContent.attack_analysis) newContent.attack_analysis = {};
                                  newContent.attack_analysis.attack_description = e.target.value;
                                  setEditContent(newContent);
                                }}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                              />
                            ) : (
                              <p className="text-xs text-neutral-700 leading-relaxed break-words whitespace-pre-wrap">{editContent?.attack_analysis?.attack_description || 'Analysis of the attack vectors and methodology.'}</p>
                            )}
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Attack Chain</h4>
                            {isEditing ? (
                              <textarea 
                                value={editContent?.attack_analysis?.attack_chain?.join('\n') || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  if (!newContent.attack_analysis) newContent.attack_analysis = {};
                                  newContent.attack_analysis.attack_chain = e.target.value.split('\n').filter((s: string) => s.trim() !== '');
                                  setEditContent(newContent);
                                }}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                placeholder="One step per line..."
                              />
                            ) : (
                              <ul className="space-y-2">
                                {(editContent?.attack_analysis?.attack_chain || ['Initial Access', 'Execution', 'Persistence']).map((step: string, i: number) => (
                                  <li key={i} className="text-xs text-neutral-700 flex gap-3 items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">MITRE ATT&CK Techniques</h4>
                            {isEditing ? (
                              <input 
                                value={editContent?.attack_analysis?.mitre_techniques?.join(', ') || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  if (!newContent.attack_analysis) newContent.attack_analysis = {};
                                  newContent.attack_analysis.mitre_techniques = e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
                                  setEditContent(newContent);
                                }}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="T1566, T1059..."
                              />
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {editContent?.attack_analysis?.mitre_techniques?.map((t: string) => (
                                  <span key={t} className="px-3 py-1 bg-neutral-100 border border-neutral-200 text-neutral-600 text-[9px] font-bold rounded uppercase tracking-widest">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    {/* 04 TOP THREATS (Weekly/Executive) */}
                    {(selectedReport.type === 'weekly_summary' || selectedReport.type === 'executive') && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">04</span>
                          <h2 className="section-title">
                            {selectedReport.type === 'weekly_summary' ? 'Top Threats Detected' : 'Notable Security Incidents'}
                          </h2>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>{selectedReport.type === 'weekly_summary' ? 'Threat / Rule' : 'Date'}</th>
                              <th>{selectedReport.type === 'weekly_summary' ? 'Count' : 'Description'}</th>
                              <th>Severity</th>
                              <th>{selectedReport.type === 'weekly_summary' ? 'Recommendation' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {(selectedReport.type === 'weekly_summary' ? (editContent.top_threats || []) : (editContent.notable_incidents || [])).map((item: any, i: number) => (
                              <tr key={i}>
                                <td className="font-bold text-neutral-900 break-words">
                                  {isEditing ? (
                                    <input 
                                      value={selectedReport.type === 'weekly_summary' ? (item.rule_description || item.threat) : (item.date || item.timestamp)}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        const list = selectedReport.type === 'weekly_summary' ? newContent.top_threats : newContent.notable_incidents;
                                        if (selectedReport.type === 'weekly_summary') {
                                          list[i].rule_description = e.target.value;
                                        } else {
                                          list[i].date = e.target.value;
                                        }
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-neutral-900"
                                    />
                                  ) : (selectedReport.type === 'weekly_summary' ? (item.rule_description || item.threat) : (item.date || item.timestamp))}
                                </td>
                                <td className="text-neutral-700 break-words">
                                  {isEditing ? (
                                    <input 
                                      value={selectedReport.type === 'weekly_summary' ? item.count : item.description}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        const list = selectedReport.type === 'weekly_summary' ? newContent.top_threats : newContent.notable_incidents;
                                        if (selectedReport.type === 'weekly_summary') {
                                          list[i].count = e.target.value;
                                        } else {
                                          list[i].description = e.target.value;
                                        }
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-neutral-700"
                                    />
                                  ) : (selectedReport.type === 'weekly_summary' ? item.count : item.description)}
                                </td>
                                <td>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase",
                                    item.severity === 'Critical' ? "bg-red-100 text-red-600" : 
                                    item.severity === 'High' ? "bg-orange-100 text-orange-600" : "bg-neutral-100 text-neutral-600"
                                  )}>{item.severity}</span>
                                </td>
                                <td className="text-neutral-500 italic">
                                  {isEditing ? (
                                    <input 
                                      value={selectedReport.type === 'weekly_summary' ? item.recommendation : item.status}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        const list = selectedReport.type === 'weekly_summary' ? newContent.top_threats : newContent.notable_incidents;
                                        if (selectedReport.type === 'weekly_summary') {
                                          list[i].recommendation = e.target.value;
                                        } else {
                                          list[i].status = e.target.value;
                                        }
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-neutral-500 italic"
                                    />
                                  ) : (selectedReport.type === 'weekly_summary' ? item.recommendation : item.status)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    )}

                    {/* 04 IOC ANALYSIS (Incident) */}
                    {selectedReport.type === 'incident_report' && editContent?.ioc_analysis?.iocs && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">04</span>
                          <h2 className="section-title">IOC Analysis & Threat Intelligence</h2>
                        </div>

                        <table>
                          <thead>
                            <tr>
                              <th>IOC Type</th>
                              <th>Value</th>
                              <th>Verdict</th>
                              <th>Threat Score</th>
                              <th>Source</th>
                              {isEditing && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {editContent.ioc_analysis.iocs.map((ioc: any, i: number) => (
                              <tr key={i}>
                                <td className="text-neutral-500 font-bold uppercase">
                                  {isEditing ? (
                                    <input 
                                      value={ioc.type}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs[i].type = e.target.value;
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-neutral-500 font-bold uppercase"
                                    />
                                  ) : ioc.type}
                                </td>
                                <td className="text-blue-600 font-mono font-bold break-all">
                                  {isEditing ? (
                                    <input 
                                      value={ioc.value}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs[i].value = e.target.value;
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-blue-600 font-mono font-bold"
                                    />
                                  ) : ioc.value}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <select 
                                      value={ioc.verdict}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs[i].verdict = e.target.value;
                                        setEditContent(newContent);
                                      }}
                                      className="bg-neutral-100 border-none rounded text-[8px] font-black uppercase focus:ring-0"
                                    >
                                      <option value="Malicious">Malicious</option>
                                      <option value="Suspicious">Suspicious</option>
                                      <option value="Clean">Clean</option>
                                    </select>
                                  ) : (
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[8px] font-black uppercase",
                                      ioc.verdict === 'Malicious' ? "bg-red-100 text-red-600" : "bg-neutral-100 text-neutral-600"
                                    )}>{ioc.verdict}</span>
                                  )}
                                </td>
                                <td className="font-bold text-neutral-900">
                                  {isEditing ? (
                                    <input 
                                      type="number"
                                      value={ioc.threat_score || '85'}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs[i].threat_score = e.target.value;
                                        setEditContent(newContent);
                                      }}
                                      className="w-12 bg-transparent border-none p-0 focus:ring-0 font-bold text-neutral-900"
                                    />
                                  ) : (ioc.threat_score || '85')}/100
                                </td>
                                <td className="text-neutral-400 font-medium italic">
                                  {isEditing ? (
                                    <input 
                                      value={ioc.source}
                                      onChange={(e) => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs[i].source = e.target.value;
                                        setEditContent(newContent);
                                      }}
                                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-neutral-400 font-medium italic"
                                    />
                                  ) : ioc.source}
                                </td>
                                {isEditing && (
                                  <td>
                                    <button 
                                      onClick={() => {
                                        const newContent = { ...editContent };
                                        newContent.ioc_analysis.iocs.splice(i, 1);
                                        setEditContent(newContent);
                                      }}
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {isEditing && (
                          <button 
                            onClick={() => {
                              const newContent = { ...editContent };
                              newContent.ioc_analysis.iocs.push({ type: 'IP', value: '', verdict: 'Suspicious', threat_score: '50', source: 'Manual Entry' });
                              setEditContent(newContent);
                            }}
                            className="w-full py-2 bg-neutral-50 hover:bg-neutral-100 text-[9px] font-bold text-neutral-500 uppercase tracking-widest border-t border-neutral-200 flex items-center justify-center gap-2"
                          >
                            <Plus className="w-3 h-3" /> Add IOC
                          </button>
                        )}
                      </section>
                    )}
                    </div>
                    {/* Footer for content pages */}
                    <div className="pt-12 mt-auto border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>KastronSec — Security Operations Center</span>
                      <span className="text-red-600">CONFIDENTIAL</span>
                    </div>
                  </div>

                  {/* --- PAGE 4: OPERATIONAL & ATTACK ANALYSIS --- */}
                  <div className="bg-white shadow-xl p-16 min-h-[1100px] flex flex-col print:shadow-none print:m-0 html2pdf__page-break">
                    {/* Header for content pages */}
                    <div className="flex justify-between items-start mb-12 border-b border-neutral-100 pb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-black tracking-tighter text-neutral-900">KASTRON</span>
                        <span className="text-lg font-black tracking-tighter text-red-600">SEC</span>
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                        {editTitle} | {new Date(selectedReport.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-y-12 flex-grow">
                    {/* 05 AGENT SUMMARY / KEY FINDINGS (Weekly) */}
                    {selectedReport.type === 'weekly_summary' && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">05</span>
                          <h2 className="section-title">Operational Intelligence</h2>
                        </div>
                        
                        <div className="space-y-8">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Agent Activity Summary</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Agent</th>
                                  <th className="text-center">Alerts</th>
                                  <th>Risk Level</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-200">
                                {(editContent.agent_summary || []).map((agent: any, i: number) => (
                                  <tr key={i}>
                                    <td className="font-bold text-neutral-900">{agent.agent_name}</td>
                                    <td className="text-center text-neutral-700">{agent.alert_count}</td>
                                    <td>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase",
                                        agent.risk_level === 'High' ? "bg-red-100 text-red-600" : "bg-neutral-100 text-neutral-600"
                                      )}>{agent.risk_level}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Key Operational Findings</h4>
                            {isEditing ? (
                              <textarea 
                                value={editContent.key_findings?.join('\n') || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  newContent.key_findings = e.target.value.split('\n').filter((s: string) => s.trim() !== '');
                                  setEditContent(newContent);
                                }}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                placeholder="One finding per line..."
                              />
                            ) : (
                              <ul className="space-y-2">
                                {(editContent.key_findings || ['No unusual activity detected', 'All critical patches applied']).map((finding: string, i: number) => (
                                  <li key={i} className="text-xs text-neutral-700 flex gap-3 items-start break-words">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                                    {finding}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    {/* 05 IMPACT ASSESSMENT (Incident) */}
                    {selectedReport.type === 'incident_report' && editContent?.impact_assessment && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">05</span>
                          <h2 className="section-title">Impact Assessment</h2>
                        </div>

                        <table>
                          <tbody className="divide-y divide-neutral-200">
                            {[
                              { key: 'affected_systems', label: 'Affected Systems', value: editContent.impact_assessment.affected_systems?.join(', ') || editContent.impact_assessment.affected_systems || 'N/A' },
                              { key: 'data_at_risk', label: 'Data at Risk', value: editContent.impact_assessment.data_at_risk || 'None identified' },
                              { key: 'business_impact', label: 'Business Impact', value: editContent.impact_assessment.business_impact || 'Minimal' },
                              { key: 'containment_status', label: 'Containment Status', value: editContent.impact_assessment.containment_status || 'Contained' },
                              { key: 'is_true_positive', label: 'True Positive', value: editContent.impact_assessment.is_true_positive || 'Yes' },
                              { key: 'ioc_confidence', label: 'Confidence Level', value: `${editContent.impact_assessment.ioc_confidence || '95'}%` }
                            ].map((item, i) => (
                              <tr key={item.label}>
                                <td className="td-label">{item.label}</td>
                                <td className="td-value">
                                  {isEditing ? (
                                    ['affected_systems', 'data_at_risk', 'business_impact'].includes(item.key) ? (
                                      <textarea 
                                        value={item.value}
                                        onChange={(e) => {
                                          const newContent = { ...editContent };
                                          if (item.key === 'affected_systems') {
                                            newContent.impact_assessment[item.key] = e.target.value.split(',').map((s: string) => s.trim());
                                          } else {
                                            newContent.impact_assessment[item.key] = e.target.value;
                                          }
                                          setEditContent(newContent);
                                        }}
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-blue-600 resize-none min-h-[20px]"
                                        rows={1}
                                        onInput={(e: any) => {
                                          e.target.style.height = 'auto';
                                          e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                      />
                                    ) : (
                                      <input 
                                        value={item.value}
                                        onChange={(e) => {
                                          const newContent = { ...editContent };
                                          newContent.impact_assessment[item.key] = e.target.value;
                                          setEditContent(newContent);
                                        }}
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-blue-600"
                                      />
                                    )
                                  ) : item.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    )}

                    {/* 06 RECOMMENDATIONS (All) */}
                    <section className="space-y-4">
                      <div className="section-header">
                        <span className="section-num">06</span>
                        <h2 className="section-title">Recommendations</h2>
                      </div>

                      <div className="space-y-8">
                        {[
                          { key: 'immediate', label: 'Immediate Actions (P0 — Do Now)', items: editContent?.recommendations?.immediate, color: 'text-red-600' },
                          { key: 'short_term', label: 'Short-Term Actions (24—48 hours)', items: editContent?.recommendations?.short_term, color: 'text-orange-600' },
                          { key: 'long_term', label: 'Long-Term / Strategic', items: editContent?.recommendations?.long_term || editContent?.recommendations?.strategic, color: 'text-blue-600' }
                        ].map(rec => (
                          <div key={rec.label} className="space-y-3">
                            <h4 className={cn("text-xs font-black uppercase tracking-widest", rec.color)}>{rec.label}</h4>
                            {isEditing ? (
                              <textarea 
                                value={rec.items?.join('\n') || ""}
                                onChange={(e) => {
                                  const newContent = { ...editContent };
                                  if (!newContent.recommendations) newContent.recommendations = {};
                                  newContent.recommendations[rec.key] = e.target.value.split('\n').filter((s: string) => s.trim() !== '');
                                  setEditContent(newContent);
                                }}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                placeholder="One recommendation per line..."
                              />
                            ) : (
                              <ul className="space-y-2">
                                {(rec.items || ['Review security logs', 'Update firewall rules']).map((item: string, i: number) => (
                                  <li key={i} className="text-xs text-neutral-700 flex gap-3 items-start break-words">
                                    <span className="w-1 h-1 rounded-full bg-neutral-400 shrink-0 mt-1.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                    </div>
                    {/* Footer for content pages */}
                    <div className="pt-12 mt-auto border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>KastronSec — Security Operations Center</span>
                      <span className="text-red-600">CONFIDENTIAL</span>
                    </div>
                  </div>

                  {/* --- PAGE 5: THREAT INTEL, IMPACT & RECOMMENDATIONS --- */}
                  <div className="bg-white shadow-xl p-16 min-h-[1100px] flex flex-col print:shadow-none print:m-0 html2pdf__page-break">
                    {/* Header for content pages */}
                    <div className="flex justify-between items-start mb-12 border-b border-neutral-100 pb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-black tracking-tighter text-neutral-900">KASTRON</span>
                        <span className="text-lg font-black tracking-tighter text-red-600">SEC</span>
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">
                        {editTitle} | {new Date(selectedReport.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="space-y-12 flex-grow">
                    {/* 07 ANALYST NOTES (Incident) */}
                    {selectedReport.type === 'incident_report' && (
                      <section className="space-y-4">
                        <div className="section-header">
                          <span className="section-num">07</span>
                          <h2 className="section-title">Analyst Notes</h2>
                        </div>
                        <div className="p-6 bg-neutral-50 border border-neutral-100 rounded-lg">
                          {isEditing ? (
                            <textarea 
                              value={editContent.analyst_notes || ""}
                              onChange={(e) => setEditContent({ ...editContent, analyst_notes: e.target.value })}
                              className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs text-blue-600 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                            />
                          ) : (
                            <p className="text-xs text-blue-600 font-bold leading-relaxed whitespace-pre-wrap italic break-words">
                              {editContent.analyst_notes || 'No additional analyst notes provided.'}
                            </p>
                          )}
                        </div>
                      </section>
                    )}

                    {/* 07/08 CONCLUSION (All) */}
                    <section className="space-y-4">
                      <div className="section-header">
                        <span className="section-num">{selectedReport.type === 'incident_report' ? '08' : '07'}</span>
                        <h2 className="section-title">Conclusion</h2>
                      </div>
                      <div className="p-6 bg-neutral-50 border border-neutral-100 rounded-lg">
                        {isEditing ? (
                          <textarea 
                            value={editContent?.conclusion || ""}
                            onChange={(e) => setEditContent({ ...editContent, conclusion: e.target.value })}
                            className="w-full bg-white border border-neutral-200 rounded-lg p-3 text-xs text-blue-600 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                          />
                        ) : (
                          <p className="text-xs text-blue-600 font-bold leading-relaxed italic break-words whitespace-pre-wrap">
                            {editContent?.conclusion || "This report was automatically generated by KastronNet AI SOC Analyst. All findings should be verified by a human analyst before final action."}
                          </p>
                        )}
                      </div>
                    </section>
                    </div>

                    {/* Footer for content pages */}
                    <div className="pt-12 mt-auto border-t border-red-600 flex justify-between items-center text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      <span>KastronSec — Security Operations Center</span>
                      <span className="text-red-600">CONFIDENTIAL</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border",
              toast.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-400" : 
              toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" : 
              "bg-blue-500/10 border-blue-500/20 text-blue-400"
            )}
          >
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-xs font-bold uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {reportToDelete && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Delete Report?</h3>
                  <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                    This action cannot be undone. The report will be permanently removed from your history.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setReportToDelete(null)}
                    className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDeleteReport(reportToDelete)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-red-600/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipient Modal */}
      <AnimatePresence>
        {isRecipientModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white tracking-tight">Add Recipient</h3>
                <button onClick={() => setIsRecipientModalOpen(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Full Name</label>
                  <input 
                    type="text" 
                    value={newRecipient.name}
                    onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Email Address</label>
                  <input 
                    type="email" 
                    value={newRecipient.email}
                    onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Role</label>
                  <select 
                    value={newRecipient.role}
                    onChange={(e) => setNewRecipient({ ...newRecipient, role: e.target.value })}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="technical">Technical</option>
                    <option value="management">Management</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <button 
                  onClick={handleAddRecipient}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-blue-600/20"
                >
                  Save Recipient
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {isEmailModalOpen && selectedReport && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white tracking-tight">Send Report</h3>
                <button onClick={() => setIsEmailModalOpen(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 block">Recipients</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {recipients.map(r => (
                      <button 
                        key={r.id}
                        onClick={() => {
                          const input = document.getElementById('email-to') as HTMLInputElement;
                          const current = input.value.split(',').map(e => e.trim()).filter(e => e);
                          if (!current.includes(r.email)) {
                            input.value = [...current, r.email].join(', ');
                          }
                        }}
                        className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] font-bold rounded-lg border border-neutral-700 transition-all"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                  <input 
                    id="email-to"
                    type="text" 
                    placeholder="Enter email addresses (comma separated)..."
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Subject</label>
                  <input 
                    id="email-subject"
                    type="text" 
                    defaultValue={`Security Report: ${selectedReport.title}`}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5 block">Message</label>
                  <textarea 
                    id="email-message"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-32 resize-none"
                    defaultValue={`Hello,\n\nPlease find the attached security report regarding ${selectedReport.title}.\n\nBest regards,\nSOC Team`}
                  />
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="radio" name="format" value="pdf" defaultChecked className="hidden" />
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-700 group-hover:border-blue-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-xs text-white font-bold">PDF Format</span>
                  </label>
                </div>
                <button 
                  onClick={() => {
                    const emailTo = (document.getElementById('email-to') as HTMLInputElement)?.value;
                    const subject = (document.getElementById('email-subject') as HTMLInputElement)?.value;
                    const message = (document.getElementById('email-message') as HTMLTextAreaElement)?.value;
                    
                    // Trigger PDF download
                    handleDownloadPDF();
                    
                    // Open device mail client with draft
                    const attachmentNote = "\n\n[ACTION REQUIRED: Please attach the saved PDF document to this email before sending.]";
                    const fullMessage = message + attachmentNote;
                    const mailtoLink = `mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`;
                    window.location.href = mailtoLink;
                    
                    showToast(`Report draft opened. Please attach the downloaded file.`, 'success');
                    setIsEmailModalOpen(false);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-blue-600/20"
                >
                  Send Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Styles */}
      {/* Upgrade Modal */}
      <AnimatePresence>
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
              
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                  <Zap className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Upgrade to Pro</h2>
                <p className="text-neutral-400 text-sm leading-relaxed mb-10">
                  You've reached your daily limit of 5 reports for the Beta version. 
                  Get the <span className="text-blue-400 font-bold">Pro</span> or <span className="text-purple-400 font-bold">Plus</span> version for unlimited AI report generation, advanced threat hunting, and custom compliance templates.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <button className="py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest shadow-xl shadow-blue-600/20">
                    View Pricing
                  </button>
                  <button onClick={() => setIsUpgradeModalOpen(false)} className="py-4 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-black rounded-2xl transition-all uppercase tracking-widest border border-neutral-700">
                    Maybe Later
                  </button>
                </div>
                
                <p className="mt-8 text-[10px] text-neutral-600 uppercase tracking-widest font-bold">
                  Trusted by 500+ Security Teams
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: white !important; color: black !important; padding: 40px !important; }
          body { background: white !important; font-family: 'Inter', sans-serif !important; }
          .custom-scrollbar { overflow: visible !important; }
          .bg-neutral-950, .bg-black, .bg-neutral-900 { background: white !important; }
          .text-white, .text-neutral-300, .text-neutral-400 { color: black !important; }
          .border-neutral-800, .border-neutral-700 { border-color: #eee !important; }
          .bg-blue-500\\/5 { background: #f0f7ff !important; }
          .border-blue-500\\/10 { border-color: #cce3ff !important; }
        }

        #report-print-area {
          font-family: 'Inter', sans-serif;
          color: #171717;
        }

        #report-print-area .section-header { 
          display: flex; 
          align-items: baseline; 
          gap: 16px; 
          margin-bottom: 24px; 
          border-bottom: 2px solid #dc2626; 
          padding-bottom: 8px; 
        }
        #report-print-area .section-num { font-size: 20px; font-weight: 900; color: #dc2626; }
        #report-print-area .section-title { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #171717; letter-spacing: 0.05em; margin: 0; }
        
        #report-print-area .highlight-box { 
          background: #fef2f2; 
          border: 1px solid #fecaca; 
          border-radius: 8px; 
          padding: 24px; 
          margin-bottom: 24px; 
        }
        #report-print-area .highlight-box p { 
          margin: 0; 
          color: #991b1b; 
          font-style: italic; 
          font-size: 12px; 
          line-height: 1.6; 
        }

        #report-print-area table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 10px; 
          border: 1px solid #e5e5e5; 
          border-radius: 8px; 
          overflow: hidden; 
          margin-bottom: 24px; 
        }
        #report-print-area th { 
          background: #1a1f2c; 
          color: white; 
          padding: 12px 16px; 
          text-transform: uppercase; 
          font-weight: 700; 
          letter-spacing: 0.05em; 
          text-align: left; 
        }
        #report-print-area td { 
          padding: 12px 16px; 
          border-bottom: 1px solid #e5e5e5; 
          color: #404040; 
        }
        #report-print-area tr:last-child td { border-bottom: none; }
        #report-print-area .td-label { 
          font-weight: 700; 
          color: #737373; 
          width: 30%; 
          border-right: 1px solid #e5e5e5; 
          background: #f9fafb; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
        }
        #report-print-area .td-value { font-weight: 700; color: #2563eb; white-space: pre-wrap; word-break: break-word; vertical-align: top; }
        #report-print-area .td-value-red { font-weight: 700; color: #dc2626; text-transform: uppercase; }

        /* Fix for html2pdf/html2canvas oklch error */
        #report-print-area .text-neutral-900 { color: #171717 !important; }
        #report-print-area .text-neutral-800 { color: #262626 !important; }
        #report-print-area .text-neutral-700 { color: #404040 !important; }
        #report-print-area .text-neutral-600 { color: #525252 !important; }
        #report-print-area .text-neutral-500 { color: #737373 !important; }
        #report-print-area .text-neutral-400 { color: #a3a3a3 !important; }
        #report-print-area .text-neutral-300 { color: #d4d4d4 !important; }
        
        #report-print-area .text-red-600 { color: #dc2626 !important; }
        #report-print-area .text-red-700 { color: #b91c1c !important; }
        #report-print-area .text-blue-600 { color: #2563eb !important; }
        #report-print-area .text-blue-700 { color: #1d4ed8 !important; }
        #report-print-area .text-orange-600 { color: #ea580c !important; }
        #report-print-area .text-green-600 { color: #16a34a !important; }
        #report-print-area .text-purple-600 { color: #9333ea !important; }
        
        #report-print-area .bg-neutral-50 { background-color: #fafafa !important; }
        #report-print-area .bg-neutral-100 { background-color: #f5f5f5 !important; }
        #report-print-area .bg-neutral-200 { background-color: #e5e5e5 !important; }
        #report-print-area .bg-red-50\\/30 { background-color: #fff5f5 !important; }
        #report-print-area .bg-blue-50\\/30 { background-color: #f0f7ff !important; }
        #report-print-area .bg-white { background-color: #ffffff !important; }
        
        #report-print-area .border-neutral-100 { border-color: #f5f5f5 !important; }
        #report-print-area .border-neutral-200 { border-color: #e5e5e5 !important; }
        #report-print-area .border-neutral-300 { border-color: #d4d4d4 !important; }
        #report-print-area .border-red-100 { border-color: #fee2e2 !important; }
        #report-print-area .border-blue-100 { border-color: #dbeafe !important; }
        #report-print-area .bg-red-600 { background-color: #dc2626 !important; }
        #report-print-area .bg-blue-600 { background-color: #2563eb !important; }
      `}</style>
    </div>
  );
}
