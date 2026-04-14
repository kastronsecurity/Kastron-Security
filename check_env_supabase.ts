
import dotenv from 'dotenv';
dotenv.config();

Object.keys(process.env).forEach(key => {
  if (key.includes('SUPABASE')) {
    console.log(`${key}: ${process.env[key] ? 'Set' : 'Not Set'}`);
  }
});
