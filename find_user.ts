
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findUser() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  const user = users.users.find((u: any) => u.email === 'sadurshansridharan531456@gmail.com');
  if (user) {
    console.log('USER_ID:', user.id);
  } else {
    console.log('User not found');
  }
}

findUser();
