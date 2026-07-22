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
  
  const menuData = await dbGet(`menuItems/${restId}`);
  console.log('--- menuItems data ---');
  console.log('Type of menuData:', typeof menuData);
  if (menuData) {
    const items = Array.isArray(menuData) ? menuData.filter(Boolean) : Object.values(menuData);
    console.log('Menu items count:', items.length);
    items.slice(0, 3).forEach(i => console.log('Item:', i.name, '| Category:', i.category, '| RestId:', i.restaurantId));
  } else {
    console.log('menuData is null!');
  }

  const catData = await dbGet(`categories/${restId}`);
  console.log('\n--- categories data ---');
  console.log('Type of catData:', typeof catData);
  if (catData) {
    const cats = Array.isArray(catData) ? catData.filter(Boolean) : Object.values(catData);
    console.log('Categories count:', cats.length);
    cats.forEach(c => console.log('Category:', c.name, '| ID:', c.id, '| RestId:', c.restaurantId));
  } else {
    console.log('catData is null!');
  }
}

run();
