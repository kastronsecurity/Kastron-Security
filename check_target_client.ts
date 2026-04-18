
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const targetId = '7cf44f70-c67a-470f-a7e4-7e8a1627d514';
  const { data: clients, error } = await supabase.from('clients').select('*').eq('id', targetId);
  if (error) {
    console.error('Error fetching client:', error);
  } else {
    console.log('Client with target ID:', clients);
  }
}

check();
