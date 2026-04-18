
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: agents, error } = await supabase.from('agents').select('*').limit(1);
  if (error) {
    console.error('Error fetching agents:', error);
  } else {
    console.log('Sample Agent:', agents[0]);
  }
}

check();
