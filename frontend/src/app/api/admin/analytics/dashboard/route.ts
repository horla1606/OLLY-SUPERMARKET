import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

function sumField(rows: Row[], field: string): number {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
}
function round2(n: number): number { return Math.round(n * 100) / 100; }

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const thisMonthStart = new Date(y, m, 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(y, m, 0).toISOString().split('T')[0];
    const ago30 = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];

    const [allRes, thisRes, lastRes, top30Res] = await Promise.all([
      supabase.from('analytics').select('revenue, sales_count'),
      supabase.from('analytics').select('revenue, sales_count').gte('date', thisMonthStart),
      supabase.from('analytics').select('revenue, sales_count').gte('date', lastMonthStart).lte('date', lastMonthEnd),
      supabase.from('analytics')
        .select('product_id, revenue, sales_count, products:product_id(name, category)')
        .gte('date', ago30)
        .not('product_id', 'is', null),
    ]);

    for (const r of [allRes, thisRes, lastRes, top30Res]) {
      if (r.error) throw r.error;
    }

    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();
    for (const row of (top30Res.data ?? []) as Row[]) {
      const pid = row.product_id as string;
      const prod = row.products as { name: string; category: string } | null;
      if (!pmap.has(pid)) {
        pmap.set(pid, { product_id: pid, name: prod?.name ?? 'Unknown', category: prod?.category ?? '', revenue: 0, sales_count: 0 });
      }
      const e = pmap.get(pid)!;
      e.revenue += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    const thisRevenue = sumField((thisRes.data as Row[]) ?? [], 'revenue');
    const lastRevenue = sumField((lastRes.data as Row[]) ?? [], 'revenue');
    const momPct = lastRevenue === 0 ? null : Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 1000) / 10;

    return Response.json({
      all_time_revenue: round2(sumField((allRes.data as Row[]) ?? [], 'revenue')),
      all_time_sales: sumField((allRes.data as Row[]) ?? [], 'sales_count'),
      this_month_revenue: round2(thisRevenue),
      last_month_revenue: round2(lastRevenue),
      mom_change_pct: momPct,
      top_products_30d: Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p) => ({ ...p, revenue: round2(p.revenue) })),
    });
  } catch (err) {
    console.error('analytics/dashboard:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
