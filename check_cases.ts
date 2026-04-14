
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runQueries() {
  console.log('--- Cases Table ---');
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('*');
  
  if (casesError) {
    console.error('Error fetching cases:', casesError);
  } else {
    console.table(cases);
  }
}

runQueries();
