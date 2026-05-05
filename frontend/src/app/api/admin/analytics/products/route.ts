import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
function round2(n: number): number { return Math.round(n * 100) / 100; }

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let q = supabase
      .from('analytics')
      .select('product_id, revenue, sales_count, products:product_id(name, category)')
      .not('product_id', 'is', null);

    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);

    const { data, error } = await q;
    if (error) throw error;

    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const pid = row.product_id as string;
      const prod = row.products as { name: string; category: string } | null;
      if (!pmap.has(pid)) {
        pmap.set(pid, { product_id: pid, name: prod?.name ?? 'Unknown', category: prod?.category ?? '', revenue: 0, sales_count: 0 });
      }
      const e = pmap.get(pid)!;
      e.revenue += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    return Response.json(
      Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((p) => ({ ...p, revenue: round2(p.revenue) }))
    );
  } catch (err) {
    console.error('analytics/products:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
