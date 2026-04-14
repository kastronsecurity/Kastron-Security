
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function insertAgents() {
  const agents = [
    { id: '000', name: 'Wazuh-Manager', status: 'active', os: 'linux', ip: '127.0.0.1', client_id: '7cf44f70-c67a-470f-a7e4-7e8a1627d514', last_keepalive: new Date().toISOString() },
    { id: '006', name: 'Agent-006', status: 'active', os: 'windows', ip: '192.168.1.106', client_id: '7cf44f70-c67a-470f-a7e4-7e8a1627d514', last_keepalive: new Date().toISOString() },
    { id: '005', name: 'Agent-005', status: 'active', os: 'linux', ip: '192.168.1.105', client_id: '7cf44f70-c67a-470f-a7e4-7e8a1627d514', last_keepalive: new Date().toISOString() }
  ];

  const { data, error } = await supabase
    .from('agents')
    .upsert(agents);
  
  if (error) {
    console.error('Error inserting agents:', error.message);
  } else {
    console.log('Successfully inserted agents:', data);
  }
}

insertAgents();
