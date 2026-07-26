import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL || 'https://lmchqykidfdyanndexjp.supabase.co';
const key = process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  throw new Error('SUPABASE_KEY is required. Add the Supabase publishable key to backend/.env.');
}

// This client is only used by the backend. Never expose SUPABASE_KEY through Vite.
export const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export function assertDb(result, message = 'Database request failed') {
  if (result.error) {
    const error = new Error(result.error.message || message);
    error.code = result.error.code;
    throw error;
  }
  return result.data;
}
