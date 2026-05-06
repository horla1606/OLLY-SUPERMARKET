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

    return Response.json(updatedOrder);
  } catch (err) {
    console.error('update order status:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
