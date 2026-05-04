import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, products:product_id(name)')
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('admin/notifications get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
