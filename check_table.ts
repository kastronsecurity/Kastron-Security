
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runQueries() {
  console.log('--- Alerts Table Info ---');
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('*')
    .limit(1);

  if (alertsError) {
    console.error('Error fetching alerts:', alertsError);
  } else {
    console.log('Alerts table columns:', Object.keys(alerts[0] || {}));
  }
}

runQueries();
