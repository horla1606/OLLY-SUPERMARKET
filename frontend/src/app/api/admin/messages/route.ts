import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, users:customer_id(id, name, email, phone)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('admin/messages get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
