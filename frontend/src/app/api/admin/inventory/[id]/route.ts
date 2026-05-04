import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { stock } = await req.json();

    if (stock === undefined || stock === null) {
      return Response.json({ message: 'stock is required' }, { status: 400 });
    }
    const parsed = parseInt(String(stock), 10);
    if (isNaN(parsed) || parsed < 0) {
      return Response.json({ message: 'stock must be a non-negative integer' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .update({ stock: parsed })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/inventory:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
