
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const currentClientId = '7cf44f70-c67a-470f-a7e4-7e8a1627d514'; // Sample ID from earlier
  const currentWazuhGroup = 'default';
  
  let query = supabase
    .from('alerts')
    .select('id, description, timestamp, severity, status, resolution_type', { count: 'exact' });

  // Matching the AlertsPage logic:
  query = query.or(`client_id.eq.${currentClientId},wazuh_group.eq.${currentWazuhGroup}`);
  
  // Default range
  query = query.range(0, 9);
  
  const { data, count, error } = await query;
  
  console.log('Error:', error);
  console.log('Count:', count);
  console.log('Data length:', data?.length);
  if (data && data.length > 0) {
      console.log('Sample data:', data[0]);
  }
}

check();
