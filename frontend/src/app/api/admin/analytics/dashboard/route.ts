import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

function round2(n: number): number { return Math.round(n * 100) / 100; }

type OrderRow = {
  total_amount: number;
  status: string;
  created_at: string;
  items: Array<{ product_id: string; product_name: string; quantity: number; price: number }>;
};

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const thisMonthStart = new Date(y, m, 1).toISOString();
    const lastMonthStart = new Date(y, m - 1, 1).toISOString();
    const lastMonthEnd   = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
    const ago30          = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // Use orders table as the reliable source of truth for revenue metrics
    const { data: ordersRaw, error: ordersErr } = await supabase
      .from('orders')
      .select('total_amount, status, created_at, items')
      .neq('status', 'cancelled');

    if (ordersErr) throw ordersErr;

    const orders = (ordersRaw ?? []) as OrderRow[];

    // All-time
    const allTimeRevenue = round2(orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0));
    const allTimeSales   = orders.length;

    // Month-over-month
    const thisMonthRevenue = round2(
      orders
        .filter(o => o.created_at >= thisMonthStart)
        .reduce((s, o) => s + Number(o.total_amount ?? 0), 0)
    );
    const lastMonthRevenue = round2(
      orders
        .filter(o => o.created_at >= lastMonthStart && o.created_at <= lastMonthEnd)
        .reduce((s, o) => s + Number(o.total_amount ?? 0), 0)
    );
    const momPct = lastMonthRevenue === 0
      ? null
      : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10;

    // Top products last 30 days — aggregate from order items (JSONB)
    const recentOrders = orders.filter(o => o.created_at >= ago30);
    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();

    for (const order of recentOrders) {
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

    // Enrich with product categories
    const topPids = Array.from(pmap.keys()).slice(0, 10);
    if (topPids.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, category')
        .in('id', topPids);
      if (products) {
        for (const p of products) {
          const entry = pmap.get(p.id);
          if (entry) entry.category = p.category ?? '';
        }
      }
    }

    return Response.json({
      all_time_revenue:   allTimeRevenue,
      all_time_sales:     allTimeSales,
      this_month_revenue: thisMonthRevenue,
      last_month_revenue: lastMonthRevenue,
      mom_change_pct:     momPct,
      top_products_30d:   Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(p => ({ ...p, revenue: round2(p.revenue) })),
    });
  } catch (err) {
    console.error('analytics/dashboard:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
