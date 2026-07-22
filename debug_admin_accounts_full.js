import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const getEnvVal = (key) => {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : '';
};

const supabaseUrl = getEnvVal('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVal('VITE_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: accountsData } = await supabase.from('app_store').select('key, data').like('key', 'restaurantAccounts%');
  console.log('--- ALL RESTAURANT ACCOUNTS ---');
  accountsData.forEach(row => {
    console.log(`KEY: ${row.key} | Email: ${row.data?.ownerEmail} | Phone: ${row.data?.ownerPhone} | Name: ${row.data?.restaurantName}`);
  });
}
run();
