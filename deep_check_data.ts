
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: groups, error: gError } = await supabase.from('alert_groups').select('id, client_id, rule_id, alert_count').limit(5);
  console.log('Sample Groups:', groups);
  
  if (groups && groups.length > 0) {
    const firstClient = groups[0].client_id;
    const { count: alertsForThatClient } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('client_id', firstClient);
    console.log(`Alerts for Client ID ${firstClient}:`, alertsForThatClient);
    
    // Check if there are ANY alerts
    const { count: totalAlerts } = await supabase.from('alerts').select('*', { count: 'exact', head: true });
    console.log('Total alerts in table:', totalAlerts);
    
    // Check client_id distribution in alerts
    const { data: dist } = await supabase.from('alerts').select('client_id');
    const counts: Record<string, number> = {};
    dist?.forEach(a => {
        const cid = a.client_id || 'NULL';
        counts[cid] = (counts[cid] || 0) + 1;
    });
    console.log('Alert Client ID distribution:', counts);
  }
}

check();
