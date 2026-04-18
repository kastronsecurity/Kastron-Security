
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: clients, error } = await supabase.from('clients').select('id, name, wazuh_group');
  if (error) {
    console.error('Error fetching clients:', error);
  } else {
    console.log('All Clients:', clients);
    
    for (const client of clients) {
       const { count: alertCount } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', client.id);
       const { count: groupCount } = await supabase.from('alert_groups').select('*', { count: 'exact', head: true }).eq('client_id', client.id);
       console.log(`Client: ${client.name} (${client.id}), Wazuh Group: ${client.wazuh_group}`);
       console.log(`  Alerts: ${alertCount}, Groups: ${groupCount}`);
    }
  }
}

check();
