
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runQueries() {
  console.log('--- Alerts Query (All Columns) ---');
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(10);

  if (alertsError) {
    console.error('Error fetching alerts:', alertsError);
  } else {
    console.table(alerts);
  }

  console.log('\n--- Clients Table ---');
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');
  
  if (clientsError) {
    console.error('Error fetching clients:', clientsError);
  } else {
    console.table(clients);
  }
}

runQueries();
