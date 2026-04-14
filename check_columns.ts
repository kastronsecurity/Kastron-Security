
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('--- Checking alert_groups schema ---');
  // We can't easily get schema via JS client without data, so let's try to insert a dummy and rollback or just check if we can select specific columns
  const columnsToTest = ['id', 'status', 'client_id', 'rule_id', 'rule_description'];
  for (const col of columnsToTest) {
    const { error } = await supabase.from('alert_groups').select(col).limit(1);
    if (error) {
      console.log(`Column "${col}" in alert_groups: MISSING or ERROR (${error.message})`);
    } else {
      console.log(`Column "${col}" in alert_groups: EXISTS`);
    }
  }

  const { data, error } = await supabase.from('alert_groups').select('*').limit(5);
  if (data && data.length > 0) {
    console.log('Sample data from alert_groups:', data[0]);
  } else {
    console.log('alert_groups is empty');
  }
}

checkColumns();
