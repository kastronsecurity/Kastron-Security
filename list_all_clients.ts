
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: clients, error } = await supabase.from('clients').select('id, name, wazuh_group, user_id');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('All Clients:', clients);
  }
}

check();
