
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgents() {
  const clientIds = [
    '7cf44f70-c67a-470f-a7e4-7e8a1627d514',
    'fedf4631-0052-46dc-a91e-090e62baee9a'
  ];

  for (const clientId of clientIds) {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('client_id', clientId);
    
    if (error) {
      console.error(`Error fetching agents for client ${clientId}:`, error);
    } else {
      console.log(`Agents for client ${clientId}:`, agents?.length);
      if (agents && agents.length > 0) {
        console.table(agents);
      }
    }
  }

  // Also check if there are ANY agents with a different client_id
  const { data: allAgents, error: allError } = await supabase
    .from('agents')
    .select('client_id');
  
  if (!allError && allAgents) {
    const uniqueClientIds = [...new Set(allAgents.map(a => a.client_id))];
    console.log('Unique client IDs in agents table:', uniqueClientIds);
  }
}

checkAgents();
