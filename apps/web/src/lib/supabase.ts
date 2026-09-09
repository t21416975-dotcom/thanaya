import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@thanaya/types';

function getEnv(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]).trim();
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {}
  return '';
}

const rawUrl = getEnv('PUBLIC_SUPABASE_URL');
const rawKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');

function isValidHttpUrl(str: string): boolean {
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  isValidHttpUrl(rawUrl) &&
  !rawUrl.includes('your-project.supabase.co') &&
  !rawUrl.includes('placeholder.supabase.co') &&
  rawKey &&
  rawKey !== 'placeholder-anon-key' &&
  rawKey !== 'your-anon-key-here'
);

const effectiveUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const effectiveKey = isSupabaseConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase: SupabaseClient<Database> = createClient<Database>(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
