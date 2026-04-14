
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlertsAgentIds() {
  const { data, error } = await supabase
    .from('alerts')
    .select('agent_id, agent_name');
  
  if (error) {
    console.error('Error fetching alerts:', error.message);
  } else {
    const agentIds = new Set(data.map(alert => alert.agent_id));
    const agentNames = new Set(data.map(alert => alert.agent_name));
    console.log('Unique Agent IDs in alerts table:', Array.from(agentIds));
    console.log('Unique Agent Names in alerts table:', Array.from(agentNames));
  }
}

checkAlertsAgentIds();
