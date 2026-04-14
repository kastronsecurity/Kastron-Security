
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgentsByClientId() {
  const clientIds = [
    '7cf44f70-c67a-470f-a7e4-7e8a1627d514',
    'fedf4631-0052-46dc-a91e-090e62baee9a'
  ];
  
  for (const id of clientIds) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('client_id', id);
    
    if (error) {
      console.error(`Error fetching agents for client ${id}:`, error.message);
    } else {
      console.log(`Agents for client ${id}:`, data?.length || 0);
    }
  }
}

checkAgentsByClientId();
