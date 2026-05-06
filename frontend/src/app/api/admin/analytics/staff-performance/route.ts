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

    const { data: rows, error } = await supabase
      .from('analytics')
      .select('staff_id, revenue, sales_count')
      .not('staff_id', 'is', null)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    // Aggregate by staff_id first
    const smap = new Map<string, { staff_id: string; name: string; email: string; revenue: number; sales_count: number }>();
    for (const row of (rows ?? []) as Row[]) {
      const sid = row.staff_id as string;
      if (!smap.has(sid)) {
        smap.set(sid, { staff_id: sid, name: 'Unknown', email: '', revenue: 0, sales_count: 0 });
      }
      const e = smap.get(sid)!;
      e.revenue += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    // Fetch staff names from staff table (NOT users table)
    const staffIds = Array.from(smap.keys());
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, name, email')
        .in('id', staffIds);
      for (const s of staffRows ?? []) {
        const entry = smap.get(s.id);
        if (entry) { entry.name = s.name; entry.email = s.email; }
      }
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
