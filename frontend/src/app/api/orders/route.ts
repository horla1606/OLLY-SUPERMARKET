import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

function generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const isManager = user!.role === 'manager';
    let query = supabase
      .from('orders')
      .select(isManager ? '*, users(name, email, phone)' : '*')
      .order('created_at', { ascending: false });

    if (!isManager) query = query.eq('customer_id', user!.id);

    const { data, error } = await query;
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('get orders:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { items, pickup_time } = await req.json() as {
      items?: Array<{ product_id: string; quantity: number }>;
      pickup_time?: string;
    };

    if (!items?.length) {
      return Response.json({ message: 'items array is required and cannot be empty' }, { status: 400 });
    }
    if (!pickup_time) {
      return Response.json({ message: 'pickup_time is required' }, { status: 400 });
    }
    const pickupDate = new Date(pickup_time);
    if (isNaN(pickupDate.getTime()) || pickupDate <= new Date()) {
      return Response.json({ message: 'pickup_time must be a valid future datetime' }, { status: 400 });
    }

    const productIds = items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (prodErr) throw prodErr;

    const productMap = new Map(products?.map((p) => [p.id, p]));
    const orderItems = [];
    let total_amount = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return Response.json({ message: `Product not found: ${item.product_id}` }, { status: 400 });
      }
      if (item.quantity < 1) {
        return Response.json({ message: `Quantity must be at least 1 for ${product.name}` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return Response.json(
          { message: `Only ${product.stock} unit(s) of "${product.name}" left in stock` },
          { status: 400 }
        );
      }
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
      });
      total_amount += product.price * item.quantity;
    }

    const pickup_code = generatePickupCode();
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user!.id,
        items: orderItems,
        total_amount: Math.round(total_amount * 100) / 100,
        pickup_time: pickupDate.toISOString(),
        status: 'pending',
        pickup_code,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    await Promise.all(
      items.map((item) => {
        const product = productMap.get(item.product_id)!;
        return supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.product_id);
      })
    );

    // Auto-assign on-duty staff + record analytics (fire-and-forget)
    const orderId = (order as { id: string }).id;
    void (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: duties } = await supabase
          .from('staff_duties')
          .select('staff_id')
          .eq('date', today)
          .limit(1);
        const staffId = duties?.[0]?.staff_id ?? null;
        if (staffId) {
          await supabase
            .from('orders')
            .update({ assigned_staff_id: staffId })
            .eq('id', orderId);
        }
        const analyticsRows = orderItems.map((item) => ({
          product_id: item.product_id,
          date: today,
          sales_count: item.quantity,
          revenue: Math.round(item.price * item.quantity * 100) / 100,
          staff_id: staffId,
        }));
        if (analyticsRows.length) await supabase.from('analytics').insert(analyticsRows);
      } catch { /* best-effort */ }
    })();

    return Response.json(order, { status: 201 });
  } catch (err) {
    console.error('create order:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
