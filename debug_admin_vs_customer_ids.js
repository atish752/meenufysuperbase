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
  console.log('--- DB INSPECTION ---');

  // 1. All rows in app_store
  const { data: allRows, error } = await supabase.from('app_store').select('key');
  if (error) {
    console.error('Error fetching keys:', error);
    return;
  }

  console.log(`Total keys in DB: ${allRows.length}`);
  
  // Categorize keys by prefix
  const keysByPrefix = {};
  allRows.forEach(r => {
    const parts = r.key.split('/');
    const prefix = parts[0];
    if (!keysByPrefix[prefix]) keysByPrefix[prefix] = [];
    keysByPrefix[prefix].push(r.key);
  });

  console.log('Key prefixes:', Object.keys(keysByPrefix));

  // 2. Inspect restaurantAccounts
  const { data: accountsData } = await supabase.from('app_store').select('key, data').like('key', 'restaurantAccounts%');
  console.log('\n--- RESTAURANT ACCOUNTS ---');
  accountsData.forEach(row => {
    console.log(`KEY: ${row.key}`);
    console.log(`DATA:`, JSON.stringify(row.data, null, 2));
  });

  // 3. Inspect menuItems keys
  const { data: menuData } = await supabase.from('app_store').select('key, data').like('key', 'menuItems%');
  console.log(`\n--- MENU ITEMS (${menuData.length} total rows) ---`);
  const menuRestIds = new Set();
  menuData.forEach(row => {
    const parts = row.key.split('/');
    if (parts.length >= 2) menuRestIds.add(parts[1]);
  });
  console.log('Restaurant IDs containing Menu Items:', Array.from(menuRestIds));

  // 4. Inspect orders keys
  const { data: orderData } = await supabase.from('app_store').select('key, data').like('key', 'orders%');
  console.log(`\n--- ORDERS (${orderData.length} total rows) ---`);
  const orderRestIds = new Set();
  orderData.forEach(row => {
    const parts = row.key.split('/');
    if (parts.length >= 2) orderRestIds.add(parts[1]);
    console.log(`Order Key: ${row.key} | Status: ${row.data?.status} | Customer: ${row.data?.customerName} | RestId in data: ${row.data?.restaurantId}`);
  });
  console.log('Restaurant IDs containing Orders:', Array.from(orderRestIds));

  // 5. Check restaurants info keys
  const { data: restData } = await supabase.from('app_store').select('key, data').like('key', 'restaurants%');
  console.log(`\n--- RESTAURANTS PROFILE (${restData.length} total rows) ---`);
  restData.forEach(row => {
    console.log(`KEY: ${row.key} | Name: ${row.data?.restaurantName} | ID: ${row.data?.id}`);
  });
}

run();
