
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  console.log('Client Count:', count);
}

check();
