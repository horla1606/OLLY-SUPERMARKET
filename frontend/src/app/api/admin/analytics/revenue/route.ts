import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

type Row = Record<string, unknown>;
function round2(n: number): number { return Math.round(n * 100) / 100; }

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'monthly';
    const now = new Date();

    let start = searchParams.get('start') ?? '';
    let end = searchParams.get('end') ?? '';

    if (!start || !end) {
      if (period === 'monthly') {
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'yearly') {
        start = new Date(now.getFullYear() - 3, 0, 1).toISOString().split('T')[0];
      } else {
        start = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      }
      end = now.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('analytics')
      .select('date, revenue, sales_count')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (error) throw error;

    const grouped = new Map<string, { label: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const d = new Date(row.date as string);
      let key: string;
      if (period === 'monthly') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = String(d.getUTCFullYear());
      } else {
        key = row.date as string;
      }
      if (!grouped.has(key)) grouped.set(key, { label: key, revenue: 0, sales_count: 0 });
      const e = grouped.get(key)!;
      e.revenue += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    return Response.json(Array.from(grouped.values()).map((r) => ({ ...r, revenue: round2(r.revenue) })));
  } catch (err) {
    console.error('analytics/revenue:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
