import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const term = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
    const sort = searchParams.get('sort');

    let query = supabase.from('products').select('*').gt('stock', 0);

    if (category) query = query.eq('category', category);
    if (term) query = query.ilike('name', `%${term}%`);

    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('name', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('get products:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { name, category, price, stock, expiry_date, image_url } = await req.json();

    if (!name || !category || price === undefined) {
      return Response.json({ message: 'name, category, and price are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        category,
        price,
        stock: stock ?? 0,
        expiry_date: expiry_date || null,
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('create product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
