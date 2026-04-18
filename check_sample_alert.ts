
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: alerts, error } = await supabase.from('alerts').select('*').limit(1);
  if (error) {
    console.error('Error fetching alerts:', error);
  } else {
    console.log('Sample Alert:', alerts[0]);
  }
}

check();
