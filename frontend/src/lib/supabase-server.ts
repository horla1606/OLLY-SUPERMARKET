import { createClient } from '@supabase/supabase-js';

function makeClient() {
  try {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  } catch {
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
}

export const supabase = makeClient();
