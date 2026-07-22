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
  const { data, error } = await supabase
    .from('app_store')
    .select('key, data')
    .like('key', 'orders%');

  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Total orders in DB:', data ? data.length : 0);
    if (data) {
      data.forEach(row => {
        const o = row.data;
        if (o) {
          console.log(`KEY: "${row.key}"`);
          console.log(`  Order ID: ${o.id}`);
          console.log(`  Restaurant ID: ${o.restaurantId}`);
          console.log(`  Customer Name: ${o.customerName}`);
          console.log(`  Total: ${o.totalAmount}`);
          console.log(`  Status: ${o.status}`);
          console.log(`  CreatedAt: ${o.createdAt} (${new Date(o.createdAt).toLocaleString()})`);
          console.log('--------------------------------------------------');
        }
      });
    }
  }

  // Also query restaurantAccounts
  const { data: accs } = await supabase.from('app_store').select('key, data').like('key', 'restaurantAccounts%');
  console.log('\nRestaurant Accounts:');
  if (accs) {
    accs.forEach(row => {
      console.log(`KEY: "${row.key}" | ID: ${row.data?.id} | Name: ${row.data?.restaurantName || row.data?.name} | Owner: ${row.data?.ownerEmail}`);
    });
  }
}
run();
