import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

interface CartItem { product_id: string; product_name: string; price: number; quantity: number; image_url?: string | null; }

async function getCartItems(customerId: string): Promise<CartItem[]> {
  const { data } = await supabase.from('carts').select('items').eq('customer_id', customerId).maybeSingle();
  return (data?.items as CartItem[]) ?? [];
}

async function saveCartItems(customerId: string, items: CartItem[]) {
  return supabase
    .from('carts')
    .upsert({ customer_id: customerId, items, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' })
    .select()
    .single();
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { product_id } = await req.json() as { product_id?: string };

    if (!product_id) {
      return Response.json({ message: 'product_id is required' }, { status: 400 });
    }

    const currentItems = await getCartItems(user!.id);
    const newItems = currentItems.filter((i) => i.product_id !== product_id);

    const { data, error } = await saveCartItems(user!.id, newItems);
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('cart/remove:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
