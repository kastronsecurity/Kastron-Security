
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAgents() {
  console.log('--- Checking Clients ---');
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('*');
  
  if (clientError) {
    console.error('Error fetching clients:', clientError);
  } else {
    console.table(clients);
  }

  console.log('\n--- Checking Agents ---');
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('*');
  
  if (agentError) {
    console.error('Error fetching agents:', agentError);
  } else {
    console.table(agents);
  }

  const userEmail = 'sadurshansridharan531456@gmail.com';
  console.log(`\n--- Checking User: ${userEmail} ---`);
  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('Error fetching users:', userError);
  } else {
    const user = (usersData.users as any[]).find(u => u.email === userEmail);
    if (user) {
      console.log('User ID:', user.id);
      const userClient = clients?.find(c => c.user_id === user.id);
      if (userClient) {
        console.log('User Client ID:', userClient.id);
        const userAgents = agents?.filter(a => a.client_id === userClient.id);
        console.log(`Agents for this client (${userAgents?.length || 0}):`);
        console.table(userAgents);
      } else {
        console.log('No client found for this user.');
      }
    } else {
      console.log('User not found.');
    }
  }
}

debugAgents();
