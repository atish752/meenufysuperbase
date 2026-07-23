import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const hasSupabaseConfig = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co'
);

export const supabase: SupabaseClient | null = hasSupabaseConfig 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

/**
 * Utility to sanitize data before writing to JSONB in Supabase.
 * Removes undefined values and non-serializable objects.
 */
export function sanitizeData(data: any): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  
  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val !== undefined && typeof val !== 'function') {
      sanitized[key] = sanitizeData(val);
    }
  }
  return sanitized;
}

/**
 * Reads data from Supabase app_store table by key or key prefix.
 */
export async function dbGet(path: string): Promise<any> {
  if (!supabase) return null;

  try {
    // 1. Try exact key match FIRST (fastest, saves 50% database query traffic)
    const { data: exactRow, error: exactErr } = await supabase
      .from('app_store')
      .select('data')
      .eq('key', path)
      .maybeSingle();

    if (!exactErr && exactRow) {
      return exactRow.data;
    }

    // 2. Try prefix match ONLY for collection folder paths (e.g. orders/rest123 or categories/rest123)
    const { data: prefixRows, error: prefixErr } = await supabase
      .from('app_store')
      .select('key, data')
      .like('key', `${path}/%`);

    if (!prefixErr && prefixRows && prefixRows.length > 0) {
      const result: Record<string, any> = {};
      const prefixLen = path.endsWith('/') ? path.length : path.length + 1;

      for (const row of prefixRows) {
        const subKey = row.key.slice(prefixLen);
        if (!subKey.includes('/')) {
          result[subKey] = row.data;
        } else {
          // Nested path key
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

    return null;
  } catch (err) {
    console.error(`dbGet error for path ${path}:`, err);
    return null;
  }
}

/**
 * Sets data at a key in Supabase app_store table.
 */
export async function dbSet(path: string, value: any): Promise<void> {
  if (!supabase) return;

  try {
    const cleanValue = sanitizeData(value);
    const { error } = await supabase
      .from('app_store')
      .upsert({
        key: path,
        data: cleanValue,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`dbSet error for path ${path}:`, error);
    }
  } catch (err) {
    console.error(`dbSet exception for path ${path}:`, err);
  }
}

/**
 * Updates existing object at path with partial fields.
 */
export async function dbUpdate(path: string, partialValue: any): Promise<void> {
  if (!supabase) return;

  try {
    const existing = await dbGet(path);
    const cleanPartial = sanitizeData(partialValue);

    let updated: any;
    if (existing && typeof existing === 'object' && !Array.isArray(existing) && typeof cleanPartial === 'object' && !Array.isArray(cleanPartial)) {
      updated = { ...existing, ...cleanPartial };
    } else {
      updated = cleanPartial;
    }

    await dbSet(path, updated);
  } catch (err) {
    console.error(`dbUpdate error for path ${path}:`, err);
  }
}

/**
 * Removes row(s) from Supabase app_store matching path or path prefix.
 */
export async function dbRemove(path: string): Promise<void> {
  if (!supabase) return;

  try {
    // Delete exact match
    await supabase.from('app_store').delete().eq('key', path);
    // Delete sub-keys
    await supabase.from('app_store').delete().like('key', `${path}/%`);
  } catch (err) {
    console.error(`dbRemove error for path ${path}:`, err);
  }
}

/**
 * Subscribes to real-time updates for a given path with minimal egress overhead.
 */
export function dbSubscribe(path: string, callback: (data: any) => void): () => void {
  if (!supabase) return () => {};

  // Fetch initial data once
  dbGet(path).then(data => callback(data)).catch(() => {});

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Set up real-time postgres changes subscription
  const channelId = `app_store_${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const channel = supabase.channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_store'
      },
      (payload) => {
        const updatedKey = (payload.new as any)?.key || (payload.old as any)?.key;
        if (!updatedKey) return;

        // Direct payload update if exact key match (zero extra network egress!)
        if (updatedKey === path && payload.new && (payload.new as any).data !== undefined) {
          callback((payload.new as any).data);
          return;
        }

        // Collection prefix match: debounced re-fetch to avoid spam
        if (updatedKey.startsWith(path + '/')) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            dbGet(path).then(data => callback(data)).catch(() => {});
          }, 300);
        }
      }
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
}

// ── Auth Helpers ──────────────────────────────────────────────
export async function signInWithEmail(email: string, pass: string) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, pass: string, meta?: any) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: meta || {} }
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChanged(callback: (user: any) => void) {
  if (!supabase) return () => {};

  // Initial user check
  supabase.auth.getUser().then(({ data }) => {
    callback(data?.user || null);
  }).catch(() => {
    callback(null);
  });

  // Listener for auth state changes
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
}

// ── Convenience aliases for AdminAuth.tsx ─────────────────────
export async function signUpUser(email: string, password: string, name?: string) {
  if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name || '' } }
  });
}

export async function signInUser(email: string, password: string) {
  if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };
  return supabase.auth.signInWithPassword({ email, password });
}
