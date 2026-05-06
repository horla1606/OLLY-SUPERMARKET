import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', params.id)
      .single();

    if (fetchErr || !order) {
      return Response.json({ message: 'Order not found' }, { status: 404 });
    }

    // Verify the order belongs to this user (check all IDs sharing the same email)
    const { data: userRows } = await supabase
      .from('users')
      .select('id')
      .eq('email', user!.email);

    const userIds = (userRows ?? []).map((r) => (r as { id: string }).id);
    if (!userIds.includes(user!.id)) userIds.push(user!.id);

    if (!userIds.includes(order.customer_id as string)) {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
    }

    if (['ready', 'completed', 'cancelled'].includes(order.status as string)) {
      return Response.json(
        { message: 'Order cannot be cancelled at this stage' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return Response.json(updated);
  } catch (err) {
    console.error('cancel order:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
