import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    // Collect all user IDs that share this email (handles duplicate accounts)
    const { data: userRows } = await supabase
      .from('users')
      .select('id')
      .eq('email', user!.email);

    const userIds = (userRows ?? []).map((r) => (r as { id: string }).id);
    if (!userIds.includes(user!.id)) userIds.push(user!.id);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('customer_id', userIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('get my orders:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
