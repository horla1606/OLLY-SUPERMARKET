import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('get my messages:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
