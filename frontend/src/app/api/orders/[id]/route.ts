import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const isManager = user!.role === 'manager';
    const { data: order, error } = await supabase
      .from('orders')
      .select(isManager ? '*, users(name, email, phone)' : '*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) throw error;
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    if (!isManager && (order as { customer_id: string }).customer_id !== user!.id) {
      return Response.json({ message: 'Access denied' }, { status: 403 });
    }

    return Response.json(order);
  } catch (err) {
    console.error('get order by id:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
