import { createClient } from '@supabase/supabase-js';

// Pass cache: 'no-store' on every internal fetch so Next.js's Data Cache
// never serves a stale Supabase response across requests.
const noStoreFetch = (url: RequestInfo | URL, opts: RequestInit = {}) =>
  fetch(url, { ...opts, cache: 'no-store' });

function makeClient() {
  try {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: noStoreFetch },
      }
    );
  } catch {
    return createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
}

export const supabase = makeClient();
