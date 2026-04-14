
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlertsByClientId() {
  const clientId = 'b961af6c-e9a7-4894-91e8-fa0fb110a21f';
  
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);
  
  if (error) {
    console.error(`Error counting alerts for client ${clientId}:`, error.message);
  } else {
    console.log(`Alerts for client ${clientId}: ${count}`);
  }
}

checkAlertsByClientId();
