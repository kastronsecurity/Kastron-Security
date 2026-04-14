
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlertsGroups() {
  const { data, error } = await supabase
    .from('alerts')
    .select('wazuh_group, client_id')
    .limit(10);
  
  if (error) {
    console.error('Error fetching alerts:', error.message);
  } else {
    console.log('Alerts Groups and Client IDs:', data);
  }
}

checkAlertsGroups();
