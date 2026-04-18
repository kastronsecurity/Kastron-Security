
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: alerts } = await supabase.from('alerts').select('client_id').limit(100);
  const counts: Record<string, number> = {};
  alerts?.forEach(a => {
    counts[a.client_id] = (counts[a.client_id] || 0) + 1;
  });
  console.log('Client ID sampling:', counts);
}

check();
