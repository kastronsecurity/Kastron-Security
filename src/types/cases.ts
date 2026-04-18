interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: 'Open' | 'Investigating' | 'Pending Review' | 'Resolved' | 'Closed';
  severity: string;
  priority: 'P1 - Critical' | 'P2 - High' | 'P3 - Medium' | 'P4 - Low';
  client_id: string;
  alert_id: string;
  agent_name: string;
  source_ip: string;
  rule_id: string;
  narrative: string;
  verdict: string;
  verdict_reason: string;
  health_score: number;
  report_id: string;
  assigned_to: string;
  escalated_by: string;
  escalated_at: string;
  tags: string[];
  sla_deadline: string;
  sla_breached: boolean;
  resolved_at: string;
  closed_by: string;
  resolution_summary: string;
  created_at: string;
  updated_at: string;
}

interface CaseEvent {
  id: string;
  case_id: string;
  client_id: string;
  event_type: 'alert_linked' | 'analyst_action' | 'system_action' | 'note_added' | 'status_changed' | 'verdict_set' | 'report_generated' | 'ip_blocked' | 'case_created';
  event_description: string;
  actor: string;
  actor_type: 'system' | 'analyst';
  metadata: any;
  created_at: string;
}

interface CaseNote {
  id: string;
  case_id: string;
  client_id: string;
  note: string;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export type { Case, CaseEvent, CaseNote };
