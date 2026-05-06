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
      .select('id, customer_id, status, items')
      .eq('id', params.id)
      .single();

    if (fetchErr || !order) {
      return Response.json({ message: 'Order not found' }, { status: 404 });
    }

    // Verify ownership — check all user IDs sharing this email
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

    // Restore stock for each item in the cancelled order (best-effort)
    try {
      const items = (order.items ?? []) as Array<{ product_id: string; quantity: number }>;
      if (items.length > 0) {
        const productIds = items.map((i) => i.product_id);
        const { data: products } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', productIds);

        if (products?.length) {
          const stockMap = new Map(products.map((p) => [p.id as string, p.stock as number]));
          await Promise.all(
            items.map((item) => {
              const current = stockMap.get(item.product_id) ?? 0;
              return supabase
                .from('products')
                .update({ stock: current + item.quantity })
                .eq('id', item.product_id);
            })
          );
        }
      }
    } catch (stockErr) {
      console.error('restore stock after cancel:', stockErr);
    }

    return Response.json(updated);
  } catch (err) {
    console.error('cancel order:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
