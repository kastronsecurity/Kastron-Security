import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

async function loadTemplate(templateName: string): Promise<ArrayBuffer> {
  const response = await fetch(`/templates/${templateName}`);
  if (!response.ok) throw new Error(`Template not found: ${templateName}`);
  return response.arrayBuffer();
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function safeArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split('\n').filter(Boolean).map(s => ({ '.': s }));
  return [];
}

function generateDocument(templateBuffer: ArrayBuffer, data: Record<string, any>): Blob {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(data);
  const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return out;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── INCIDENT REPORT ──────────────────────────────────────────
export async function downloadIncidentReport(report: any, clientName: string) {
  const templateBuffer = await loadTemplate('incident_template.docx');
  const content = report.content || {};
  const details = content.incident_details || {};
  const attack = content.attack_analysis || {};
  const ioc = content.ioc_analysis || {};
  const impact = content.impact_assessment || {};
  const recs = content.recommendations || {};

  const data = {
    // Cover info
    client_name:        clientName || 'N/A',
    report_title:       report.title || 'Incident Report',
    report_id:          `IR-${new Date().getFullYear()}-${report.id?.slice(0,6).toUpperCase() || 'XXXX'}`,
    generated_by:       report.generated_by || 'KastronSec Analyst',
    created_at:         formatDateTime(report.created_at),

    // Executive summary & conclusion
    executive_summary:  content.executive_summary || 'N/A',
    conclusion:         content.conclusion || 'N/A',
    analyst_notes:      content.analyst_notes || 'N/A',

    // Incident details
    alert_id:           details.alert_id || report.alert_id || 'N/A',
    alert_description:  details.title || report.title || 'N/A',
    severity:           details.severity || 'N/A',
    rule_id:            details.rule_id || report.alert_id || 'N/A',
    rule_level:         details.rule_level || 'N/A',
    agent_name:         details.agent || report.agent_name || 'N/A',
    source_ip:          details.source_ip || 'N/A',
    dest_ip:            details.dest_ip || 'N/A',
    timestamp:          formatDateTime(details.timestamp || report.date_from),
    priority:           details.priority || 'P2 - High',
    assigned_to:        details.assigned_to || 'N/A',

    // Attack analysis
    attack_type:        attack.attack_type || 'N/A',
    attack_description: attack.description || 'N/A',
    mitre_techniques:   Array.isArray(attack.mitre_techniques)
                          ? attack.mitre_techniques.join(', ')
                          : (attack.mitre_techniques || 'N/A'),
    attack_chain:       safeArray(attack.attack_chain).map(s =>
                          typeof s === 'string' ? { '.': s } : s
                        ),
    mitre_techniques_list: safeArray(attack.mitre_techniques).map(s =>
                          typeof s === 'string' ? { '.': s } : s
                        ),

    // IOC analysis
    ioc_overall_verdict:  ioc.overall_verdict || ioc.verdict || 'N/A',
    ioc_confidence:       ioc.confidence ?? 'N/A',
    is_true_positive:     ioc.is_true_positive === true ? 'Yes'
                            : ioc.is_true_positive === false ? 'No' : 'Under Investigation',
    ioc_justification:    ioc.justification || 'N/A',
    ioc_analysis: {
      iocs: safeArray(ioc.iocs).map((iocItem: any) => ({
        type:         iocItem.type || 'N/A',
        value:        iocItem.value || 'N/A',
        verdict:      iocItem.verdict || 'N/A',
        threat_score: iocItem.threat_score ?? iocItem.score ?? 'N/A',
        source:       iocItem.source || 'N/A',
      }))
    },

    // Impact assessment
    affected_systems:   Array.isArray(impact.affected_systems)
                          ? impact.affected_systems.join(', ')
                          : (impact.affected_systems || 'N/A'),
    data_at_risk:       impact.data_at_risk || 'N/A',
    business_impact:    impact.business_impact || 'N/A',
    containment_status: impact.containment_status || 'N/A',

    // Recommendations
    recommendations: {
      immediate:   safeArray(recs.immediate).map((s: any) => ({ '.': typeof s === 'string' ? s : String(s) })),
      short_term:  safeArray(recs.short_term).map((s: any) => ({ '.': typeof s === 'string' ? s : String(s) })),
      long_term:   safeArray(recs.long_term).map((s: any) => ({ '.': typeof s === 'string' ? s : String(s) })),
    },
  };

  const blob = generateDocument(templateBuffer, data);
  const filename = `${report.title?.replace(/[^a-z0-9]/gi, '_') || 'Incident_Report'}_${new Date().toISOString().slice(0,10)}.docx`;
  downloadBlob(blob, filename);
}

// ── WEEKLY SUMMARY ───────────────────────────────────────────
export async function downloadWeeklyReport(report: any, clientName: string) {
  const templateBuffer = await loadTemplate('weekly_template.docx');
  const content = report.content || {};
  const overview = content.overview || {};
  const recs = content.recommendations || {};

  const data = {
    // Cover info
    client_name:      clientName || 'N/A',
    report_title:     report.title || 'Weekly Security Summary',
    report_id:        `WS-${new Date().getFullYear()}-W${getWeekNumber()}`,
    generated_by:     report.generated_by || 'KastronSec Analyst',
    created_at:       formatDate(report.created_at),
    date_from:        formatDate(report.date_from),
    date_to:          formatDate(report.date_to),

    // Alert stats
    total_alerts:     overview.total_alerts ?? 0,
    critical_alerts:  overview.critical_count ?? 0,
    high_alerts:      overview.high_count ?? 0,
    medium_alerts:    overview.medium_count ?? 0,
    low_alerts:       overview.low_count ?? 0,
    resolved_count:   overview.resolved_count ?? 0,
    open_count:       overview.open_count ?? 0,
    auto_closed_count: overview.auto_closed ?? 0,
    trend_vs_last_week: overview.trend_vs_last_week || 'No change',

    // AI insights & summaries
    ai_insights:      content.ai_insights || 'N/A',
    executive_summary: content.executive_summary || 'N/A',
    conclusion:       content.conclusion || content.executive_summary || 'N/A',

    // Top threats loop
    top_threats: safeArray(content.top_threats).map((t: any) => ({
      threat:         t.rule_description || t.threat || 'N/A',
      count:          t.count ?? 0,
      severity:       t.severity || 'N/A',
      recommendation: t.recommendation || 'N/A',
    })),

    // Agent summary loop
    agent_summary: safeArray(content.agent_summary).map((a: any) => ({
      agent_name:        a.agent_name || 'N/A',
      alert_count:       a.alert_count ?? 0,
      critical_high_count: a.critical_count ?? 0,
      agent_status:      a.status || 'Active',
      top_rule:          a.top_rule || 'N/A',
      risk_level:        a.risk_level || 'N/A',
    })),

    // Key findings loop
    key_findings: safeArray(content.key_findings).map((f: any) => ({
      '.': typeof f === 'string' ? f : String(f)
    })),

    // Recommendations
    recommendations: {
      immediate: safeArray(recs.immediate).map((s: any) => ({ '.': typeof s === 'string' ? s : String(s) })),
      strategic: safeArray(recs.strategic || recs.long_term).map((s: any) => ({ '.': typeof s === 'string' ? s : String(s) })),
    },
  };

  const blob = generateDocument(templateBuffer, data);
  const filename = `${report.title?.replace(/[^a-z0-9]/gi, '_') || 'Weekly_Summary'}_${new Date().toISOString().slice(0,10)}.docx`;
  downloadBlob(blob, filename);
}

// ── EXECUTIVE SUMMARY ────────────────────────────────────────
export async function downloadExecutiveReport(report: any, clientName: string) {
  const templateBuffer = await loadTemplate('executive_template.docx');
  const content = report.content || {};
  const overview = content.overview || {};
  const recs = content.recommendations || {};

  const data = {
    // Cover info
    client_name:      clientName || 'N/A',
    report_title:     report.title || 'Executive Security Briefing',
    report_id:        `ES-${new Date().getFullYear()}-${report.id?.slice(0,6).toUpperCase() || 'XXXX'}`,
    generated_by:     report.generated_by || 'KastronSec Analyst',
    created_at:       formatDate(report.created_at),
    date_from:        formatDate(report.date_from),
    date_to:          formatDate(report.date_to),
    prepared_for:     content.prepared_for || 'Executive Leadership',

    // Risk posture
    overall_risk_level:   content.overall_risk_level || calculateRiskLevel(overview),
    open_count:           overview.open_count ?? 0,
    total_alerts:         overview.total_alerts ?? 0,
    systems_monitored:    content.systems_monitored || overview.agents_monitored || 'N/A',
    detection_coverage:   content.detection_coverage || '100',

    // Summaries
    executive_summary:  content.executive_summary || 'N/A',
    business_impact:    content.business_impact || content.ai_insights || 'N/A',
    conclusion:         content.conclusion || content.executive_summary || 'N/A',

    // Key metrics
    critical_alerts:        overview.critical_count ?? 0,
    high_alerts:            overview.high_count ?? 0,
    mean_time_to_detect:    content.mean_time_to_detect || 'N/A',
    mean_time_to_respond:   content.mean_time_to_respond || 'N/A',
    false_positive_rate:    content.false_positive_rate || '0',
    systems_at_risk:        content.systems_at_risk || overview.critical_count || '0',
    trend_vs_last_week:     overview.trend_vs_last_week || 'N/A',
    critical_trend:         content.critical_trend || 'N/A',
    mttd_trend:             content.mttd_trend || 'N/A',
    mttr_trend:             content.mttr_trend || 'N/A',
    fpr_trend:              content.fpr_trend || 'N/A',
    sar_trend:              content.sar_trend || 'N/A',

    // Compliance
    pci_dss_status:   content.pci_dss_status || 'Under Review',
    hipaa_status:     content.hipaa_status || 'Under Review',
    gdpr_status:      content.gdpr_status || 'Under Review',
    patch_coverage:   content.patch_coverage || '100',

    // Notable incidents loop
    notable_incidents: safeArray(content.notable_incidents || content.top_threats).map((i: any) => ({
      incident_date:        formatDate(i.date || i.timestamp) || 'N/A',
      incident_description: i.description || i.rule_description || i.threat || 'N/A',
      incident_severity:    i.severity || 'N/A',
      incident_status:      i.status || 'Resolved',
    })),

    // Recommendations loop
    recommendations: safeArray(recs.immediate || recs.strategic || recs).map((s: any) => ({
      '.': typeof s === 'string' ? s : String(s)
    })),
  };

  const blob = generateDocument(templateBuffer, data);
  const filename = `${report.title?.replace(/[^a-z0-9]/gi, '_') || 'Executive_Summary'}_${new Date().toISOString().slice(0,10)}.docx`;
  downloadBlob(blob, filename);
}

// ── Helpers ──────────────────────────────────────────────────
function getWeekNumber(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return String(week).padStart(2, '0');
}

function calculateRiskLevel(overview: any): string {
  const critical = overview.critical_count ?? 0;
  const high = overview.high_count ?? 0;
  if (critical > 0) return 'HIGH';
  if (high > 3) return 'MEDIUM';
  return 'LOW';
}
