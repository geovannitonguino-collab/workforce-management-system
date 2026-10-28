import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}

/**
 * Read the auth parameters of the landing URL BEFORE the client consumes and clears them.
 * Recovery links arrive as /#access_token=...&type=recovery, failed ones as /#error=...&error_code=otp_expired.
 */
function readLandingAuthParams(): { recovery: boolean; error: string | null } {
  if (typeof window === 'undefined') return { recovery: false, error: null };
  const raw = `${window.location.hash.replace(/^#/, '')}&${window.location.search.replace(/^\?/, '')}`;
  const params = new URLSearchParams(raw);
  return {
    recovery: params.get('type') === 'recovery',
    error: params.get('error_code') ?? params.get('error'),
  };
}
export const landingAuth = readLandingAuthParams();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
