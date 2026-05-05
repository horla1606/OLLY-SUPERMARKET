import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return Response.json({ message: 'Product not found' }, { status: 404 });
    }
    return Response.json(data);
  } catch (err) {
    console.error('get product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const allowed = ['name', 'category', 'price', 'stock', 'expiry_date', 'image_url'];
    const updates = Object.fromEntries(
      Object.entries(body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(updates).length === 0) {
      return Response.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('update product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { error } = await supabase.from('products').delete().eq('id', params.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('delete product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
