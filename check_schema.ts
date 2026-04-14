
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking Schema via SQL RPC ---');
  // This might fail if the RPC doesn't exist, but it's worth a shot to see if we can run raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients'" 
  });

  if (error) {
    console.log('RPC failed (expected if not set up):', error.message);
    
    // Check the client record
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*');
    
    if (clientError) {
      console.error('Client query error:', clientError.message);
    } else {
      console.log('All Clients:', clients);
    }
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
