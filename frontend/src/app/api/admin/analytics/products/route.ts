import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

function round2(n: number): number { return Math.round(n * 100) / 100; }

type OrderRow = {
  total_amount: number;
  created_at: string;
  items: Array<{ product_id: string; product_name: string; quantity: number; price: number }>;
};

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end   = searchParams.get('end');

    // Use orders table for accurate product revenue data
    let q = supabase
      .from('orders')
      .select('total_amount, created_at, items')
      .neq('status', 'cancelled');

    // The frontend sends dates in YYYY-MM-DD, orders.created_at is ISO timestamp
    if (start) q = q.gte('created_at', start);
    if (end)   q = q.lte('created_at', end + 'T23:59:59.999Z');

    const { data: orders, error } = await q;
    if (error) throw error;

    // Aggregate revenue and sales per product from order items
    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();
    for (const order of (orders ?? []) as OrderRow[]) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const pid = item.product_id;
        if (!pid) continue;
        if (!pmap.has(pid)) {
          pmap.set(pid, { product_id: pid, name: item.product_name ?? 'Unknown', category: '', revenue: 0, sales_count: 0 });
        }
        const e = pmap.get(pid)!;
        e.revenue     += Number(item.price    ?? 0) * Number(item.quantity ?? 0);
        e.sales_count += Number(item.quantity ?? 0);
      }
    }

    // Enrich with current product names and categories
    const productIds = Array.from(pmap.keys());
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category')
        .in('id', productIds);
      for (const p of products ?? []) {
        const entry = pmap.get(p.id);
        if (entry) { entry.name = p.name; entry.category = p.category ?? ''; }
      }
    }

    return Response.json(
      Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(p => ({ ...p, revenue: round2(p.revenue) }))
    );
  } catch (err) {
    console.error('analytics/products:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
