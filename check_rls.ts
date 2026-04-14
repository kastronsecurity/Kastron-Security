
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('--- Checking RLS status for alert_groups ---');
  const { data, error } = await supabase.rpc('check_rls_enabled', { table_name: 'alert_groups' });
  
  if (error) {
    // If RPC doesn't exist, try to query pg_class
    const { data: pgData, error: pgError } = await supabase.from('pg_class').select('relname, relrowsecurity').eq('relname', 'alert_groups').single();
    if (pgError) {
      console.log('Could not check RLS status via pg_class:', pgError.message);
      // Try another way: check if we can see data with anon key vs service role key
      const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { count: anonCount } = await anonClient.from('alert_groups').select('*', { count: 'exact', head: true });
      const { count: serviceCount } = await supabase.from('alert_groups').select('*', { count: 'exact', head: true });
      console.log(`Anon count: ${anonCount}, Service count: ${serviceCount}`);
      if (anonCount === 0 && serviceCount !== 0) {
        console.log('RLS is likely ENABLED and restricting access.');
      } else if (serviceCount === 0) {
        console.log('Table is empty for both keys.');
      } else {
        console.log('RLS might be DISABLED or policies are permissive.');
      }
    } else {
      console.log(`Table: ${pgData.relname}, RLS Enabled: ${pgData.relrowsecurity}`);
    }
  } else {
    console.log('RLS Enabled:', data);
  }
}

checkRLS();
