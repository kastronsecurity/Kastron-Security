
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgentsInAlerts() {
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('agent_id, agent_name')
    .limit(100);
  
  if (alertsError) {
    console.error('Error fetching alerts:', alertsError.message);
    return;
  }

  const agentIds = [...new Set(alerts.map(a => a.agent_id).filter(Boolean))];
  console.log('Unique Agent IDs in alerts:', agentIds);

  for (const id of agentIds) {
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (agentError) {
      console.error(`Error fetching agent ${id}:`, agentError.message);
    } else {
      console.log(`Agent ${id} in agents table:`, agent ? 'Found' : 'Not Found');
    }
  }
}

checkAgentsInAlerts();
