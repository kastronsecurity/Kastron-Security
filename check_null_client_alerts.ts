
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { count } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).is('client_id', null);
  console.log('Alerts with NULL client_id:', count);
}

check();
