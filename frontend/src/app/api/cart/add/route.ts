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

async function getCartItems(customerId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from('carts')
    .select('items')
    .eq('customer_id', customerId)
    .maybeSingle();
  return (data?.items as CartItem[]) ?? [];
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

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { product_id, quantity = 1 } = await req.json() as { product_id?: string; quantity?: number };

    if (!product_id) {
      return Response.json({ message: 'product_id is required' }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return Response.json({ message: 'quantity must be a positive integer' }, { status: 400 });
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, price, image_url, stock')
      .eq('id', product_id)
      .maybeSingle();

    if (prodErr || !product) {
      return Response.json({ message: 'Product not found' }, { status: 404 });
    }
    if (product.stock === 0) {
      return Response.json({ message: `${product.name} is out of stock` }, { status: 400 });
    }

    const currentItems = await getCartItems(user!.id);
    const existing = currentItems.find((i) => i.product_id === product_id);
    const newQty = (existing?.quantity ?? 0) + quantity;

    if (newQty > product.stock) {
      return Response.json(
        { message: `Only ${product.stock} unit(s) of "${product.name}" available` },
        { status: 400 }
      );
    }

    const newItems: CartItem[] = existing
      ? currentItems.map((i) => (i.product_id === product_id ? { ...i, quantity: newQty } : i))
      : [
          ...currentItems,
          {
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity,
            image_url: product.image_url ?? null,
          },
        ];

    const { data, error } = await saveCartItems(user!.id, newItems);
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('cart/add:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
