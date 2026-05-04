import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
}

async function saveCartItems(customerId: string, items: CartItem[]) {
  return supabase
    .from('carts')
    .upsert(
      { customer_id: customerId, items, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    )
    .select()
    .single();
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('customer_id', user!.id)
      .maybeSingle();

    if (error) throw error;
    return Response.json(
      data ?? { customer_id: user!.id, items: [], updated_at: new Date().toISOString() }
    );
  } catch (err) {
    console.error('get cart:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { items } = await req.json() as { items?: Array<{ product_id: string; quantity: number }> };

    if (!Array.isArray(items)) {
      return Response.json({ message: 'items must be an array' }, { status: 400 });
    }

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .in('id', productIds);

    const productMap = new Map(products?.map((p) => [p.id, p]));
    const enriched: CartItem[] = items
      .filter((i) => productMap.has(i.product_id) && i.quantity > 0)
      .map((i) => {
        const p = productMap.get(i.product_id)!;
        return {
          product_id: p.id,
          product_name: p.name,
          price: p.price,
          quantity: i.quantity,
          image_url: p.image_url,
        };
      });

    const { data, error } = await saveCartItems(user!.id, enriched);
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('cart put:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { error } = await supabase.from('carts').delete().eq('customer_id', user!.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('cart clear:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
