
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('--- Testing Insert into clients ---');
  const testId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase
    .from('clients')
    .insert({
      id: testId,
      name: 'Test Client',
      wazuh_group: 'G-test',
      install_key: 'test-key-' + Date.now()
    })
    .select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', testId);
    
    if (deleteError) console.error('Delete error:', deleteError);
    else console.log('Cleanup success');
  }
}

testInsert();
