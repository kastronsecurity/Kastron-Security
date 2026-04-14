
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('client_id')
    .limit(10);
    
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('Sample client_ids:', data.map(a => a.client_id));
}

checkAlerts();
