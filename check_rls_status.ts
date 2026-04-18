
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'alerts' });
  if (error) {
    // maybe rpc doesn't exist
    const { data: rlsStatus } = await supabase.from('alerts').select('*').limit(1);
    console.log('Sample data fetched via anon:', rlsStatus);
  } else {
    console.log('Policies for alerts:', data);
  }
}

check();
