
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgents() {
  const { count, error } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error fetching agents:', error);
  } else {
    console.log('Agent count:', count);
  }

  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*');
  
  if (agentError) {
    console.error('Error fetching agents data:', agentError);
  } else {
    console.log('Agents data:');
    console.table(agents);
  }
}

checkAgents();
