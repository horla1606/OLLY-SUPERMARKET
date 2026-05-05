import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const isManager = user!.role === 'manager';
    const { data: order, error } = await supabase
      .from('orders').select('*').eq('id', params.id).maybeSingle();

    if (error) throw error;
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    const orderRecord = order as Record<string, string>;
    if (!isManager && orderRecord.customer_id !== user!.id) {
      return Response.json({ message: 'Access denied' }, { status: 403 });
    }

    if (isManager) {
      const { data: u } = await supabase
        .from('users').select('name, email, phone').eq('id', orderRecord.customer_id).maybeSingle();
      return Response.json({ ...order, users: u ?? null });
    }
    return Response.json(order);
  } catch (err) {
    console.error('get order by id:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
