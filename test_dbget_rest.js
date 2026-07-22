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

async function dbGet(path) {
  // 1. Try prefix match for nested collections (e.g. orders/rest123/order1)
  const { data: prefixRows, error: prefixErr } = await supabase
    .from('app_store')
    .select('key, data')
    .like('key', `${path}/%`);

  if (!prefixErr && prefixRows && prefixRows.length > 0) {
    const result = {};
    const prefixLen = path.endsWith('/') ? path.length : path.length + 1;

    for (const row of prefixRows) {
      const subKey = row.key.slice(prefixLen);
      if (!subKey.includes('/')) {
        result[subKey] = row.data;
      } else {
        const parts = subKey.split('/');
        let curr = result;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = row.data;
      }
    }
    return result;
  }

  // 2. Try exact key match
  const { data: exactRow, error: exactErr } = await supabase
    .from('app_store')
    .select('data')
    .eq('key', path)
    .maybeSingle();

  if (!exactErr && exactRow) {
    return exactRow.data;
  }

  return null;
}

async function run() {
  const restId = 'b92eabc0-d08a-40ac-bd1a-e2ff086f9a84';
  const data = await dbGet(`orders/${restId}`);
  console.log('dbGet orders result:', JSON.stringify(data, null, 2));

  const ords = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)).filter(Boolean) : [];
  console.log('Parsed orders count:', ords.length);
  ords.forEach(o => {
    console.log(`Order ID: ${o.id} | Status: ${o.status} | CreatedAt: ${o.createdAt}`);
  });
}
run();
