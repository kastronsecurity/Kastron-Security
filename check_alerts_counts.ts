
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  console.log('Clients:', clients);

  const { count: totalAlerts } = await supabase.from('alerts').select('*', { count: 'exact', head: true });
  console.log('Total Alerts in DB:', totalAlerts);

  if (clients) {
    for (const client of clients) {
      const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', client.id);
      console.log(`Alerts for client ${client.name} (${client.id}):`, count);
    }
  }
}

check();
