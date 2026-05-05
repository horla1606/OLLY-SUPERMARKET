import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { status } = await req.json();
    const validStatuses = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return Response.json(
        { message: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Record analytics when completed (fire-and-forget)
    if (status === 'completed' && updatedOrder) {
      void (async () => {
        try {
          const order = updatedOrder as {
            items: Array<{ product_id: string; quantity: number; price: number }>;
            assigned_staff_id?: string;
          };
          const today = new Date().toISOString().split('T')[0];
          const rows = (order.items ?? []).map((item) => ({
            product_id: item.product_id,
            date: today,
            sales_count: item.quantity,
            revenue: Math.round(item.price * item.quantity * 100) / 100,
            staff_id: order.assigned_staff_id ?? null,
          }));
          if (rows.length) await supabase.from('analytics').insert(rows);
        } catch { /* best-effort */ }
      })();
    }

    return Response.json(updatedOrder);
  } catch (err) {
    console.error('update order status:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
