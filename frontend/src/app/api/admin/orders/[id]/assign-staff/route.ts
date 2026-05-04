import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { staff_id } = await req.json();

    if (!staff_id) {
      return Response.json({ message: 'staff_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ assigned_staff_id: staff_id })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/assign staff to order:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
