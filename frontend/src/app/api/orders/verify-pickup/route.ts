import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { pickup_code } = await req.json();

    if (!pickup_code) {
      return Response.json({ message: 'pickup_code is required' }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users(name, email, phone)')
      .eq('pickup_code', String(pickup_code).trim())
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return Response.json({ message: 'No order found for this pickup code' }, { status: 404 });
    }

    return Response.json(order);
  } catch (err) {
    console.error('verify pickup:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
