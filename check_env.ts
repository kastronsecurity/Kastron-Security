
import dotenv from 'dotenv';
dotenv.config();

console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Set' : 'Not Set');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not Set');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not Set');
console.log('NODE_ENV:', process.env.NODE_ENV);
