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
    const startDate = searchParams.get('start') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const endDate = searchParams.get('end') ?? new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('analytics')
      .select('staff_id, revenue, sales_count, users:staff_id(name, email)')
      .not('staff_id', 'is', null)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    const smap = new Map<string, { staff_id: string; name: string; email: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const sid = row.staff_id as string;
      const u = row.users as { name: string; email: string } | null;
      if (!smap.has(sid)) {
        smap.set(sid, { staff_id: sid, name: u?.name ?? 'Unknown', email: u?.email ?? '', revenue: 0, sales_count: 0 });
      }
      const e = smap.get(sid)!;
      e.revenue += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    return Response.json(
      Array.from(smap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((s) => ({ ...s, revenue: round2(s.revenue) }))
    );
  } catch (err) {
    console.error('analytics/staff-performance:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
