-- Supabase RLS Setup for KastronSec
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_intel_cache ENABLE ROW LEVEL SECURITY;

-- 2. Clients Table: Users can only see their own client record
CREATE POLICY "Users can view own client" ON clients
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Scoped Tables: Users can only see data belonging to their client_id
-- We use a helper function to get the user's client_id for efficiency

CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid AS $$
  SELECT id FROM clients WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Agents
CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (client_id = get_my_client_id());
CREATE POLICY "Users can insert own agents" ON agents
  FOR INSERT WITH CHECK (client_id = get_my_client_id());
CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (client_id = get_my_client_id());
CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE USING (client_id = get_my_client_id());

-- Agent Deletions
CREATE POLICY "Users can manage own agent deletions" ON agent_deletions
  FOR ALL USING (client_id = get_my_client_id());

-- Custom Rules
CREATE POLICY "Users can manage own custom rules" ON custom_rules
  FOR ALL USING (client_id = get_my_client_id());

-- Cases
CREATE POLICY "Users can manage own cases" ON cases
  FOR ALL USING (client_id = get_my_client_id());

-- Alerts
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (client_id = get_my_client_id());
CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING (client_id = get_my_client_id());

-- Events
CREATE POLICY "Users can view own events" ON events
  FOR SELECT USING (client_id = get_my_client_id());

-- Alert Groups
CREATE POLICY "Users can manage own alert groups" ON alert_groups
  FOR ALL USING (client_id = get_my_client_id());

-- Alert Playbooks
CREATE POLICY "Users can manage own alert playbooks" ON alert_playbooks
  FOR ALL USING (client_id = get_my_client_id());

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id),
  title text NOT NULL,
  content text,
  type text,
  status text DEFAULT 'Draft',
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  alert_id text
);

CREATE POLICY "Users can manage own reports" ON reports
  FOR ALL USING (client_id = get_my_client_id());

-- Threat Intel Cache: Publicly readable (shared cache), but only system/admin can insert/update
-- Or we can scope it too if preferred, but usually threat intel is global.
-- Let's make it readable by all authenticated users.
CREATE POLICY "Authenticated users can view threat intel" ON threat_intel_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert threat intel" ON threat_intel_cache
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Investigation Workspace Tables
CREATE TABLE IF NOT EXISTS investigation_workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escalation_id uuid REFERENCES escalations(id),
  case_id uuid REFERENCES cases(id),
  client_id uuid REFERENCES clients(id),
  opened_by text,
  status text DEFAULT 'active',
  checklist jsonb DEFAULT '{}',
  checklist_items jsonb DEFAULT '[]',
  ai_narrative jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES investigation_workspaces(id),
  escalation_id uuid REFERENCES escalations(id),
  client_id uuid REFERENCES clients(id),
  note text NOT NULL,
  is_key_finding boolean DEFAULT false,
  added_by text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES investigation_workspaces(id),
  escalation_id uuid REFERENCES escalations(id),
  client_id uuid REFERENCES clients(id),
  evidence_type text,
  title text,
  description text,
  data jsonb DEFAULT '{}',
  source text,
  confidence text,
  added_by text,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS for Investigation Tables
ALTER TABLE investigation_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own investigation_workspaces" ON investigation_workspaces
  FOR ALL USING (client_id = get_my_client_id());
CREATE POLICY "Users can manage own investigation_notes" ON investigation_notes
  FOR ALL USING (client_id = get_my_client_id());
CREATE POLICY "Users can manage own investigation_evidence" ON investigation_evidence
  FOR ALL USING (client_id = get_my_client_id());
