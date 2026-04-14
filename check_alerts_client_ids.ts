
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlertsClientIds() {
  const { data, error } = await supabase
    .from('alerts')
    .select('client_id');
  
  if (error) {
    console.error('Error fetching alerts:', error.message);
  } else {
    const clientIds = new Set(data.map(alert => alert.client_id));
    console.log('Unique Client IDs in alerts table:', Array.from(clientIds));
  }
}

checkAlertsClientIds();
