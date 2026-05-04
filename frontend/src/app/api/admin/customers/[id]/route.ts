import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const [userRes, ordersRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, name, phone, created_at')
        .eq('id', params.id)
        .eq('role', 'customer')
        .maybeSingle(),
      supabase
        .from('orders')
        .select('*')
        .eq('customer_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

    if (userRes.error) throw userRes.error;
    if (!userRes.data) {
      return Response.json({ message: 'Customer not found' }, { status: 404 });
    }
    if (ordersRes.error) throw ordersRes.error;

    return Response.json({ customer: userRes.data, orders: ordersRes.data ?? [] });
  } catch (err) {
    console.error('admin/customers/:id:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', params.id)
      .eq('role', 'customer');

    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('admin/customers delete:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
