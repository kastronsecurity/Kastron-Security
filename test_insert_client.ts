
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsertClient() {
  const { data, error } = await supabase
    .from('clients')
    .insert([
      {
        user_id: '00000000-0000-0000-0000-000000000000', // Dummy user ID
        name: 'Test Client',
        install_key: 'test-key',
        wazuh_group: 'default'
      }
    ])
    .select();
  
  if (error) {
    console.error('Error inserting client:', error.message);
  } else {
    console.log('Inserted Client:', data);
  }
}

testInsertClient();
