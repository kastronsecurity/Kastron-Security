
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlerts() {
  const clientId = 'b961af6c-e9a7-4894-91e8-fa0fb110a21f';
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('client_id', clientId)
    .limit(5);
  
  if (error) {
    console.error('Error fetching alerts:', error);
  } else {
    console.log(`Alerts for client ${clientId}:`, alerts?.length);
    if (alerts && alerts.length > 0) {
      console.table(alerts.map(a => ({ id: a.id, description: a.description, agent_name: a.agent_name })));
    }
  }

  // Also check if there are ANY alerts with a different client_id
  const { data: allAlerts, error: allError } = await supabase
    .from('alerts')
    .select('client_id')
    .limit(100);
  
  if (!allError && allAlerts) {
    const clientIds = [...new Set(allAlerts.map(a => a.client_id))];
    console.log('Unique client IDs in alerts table:', clientIds);
  }
}

checkAlerts();
