import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

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
    let end   = searchParams.get('end')   ?? '';

    if (!start || !end) {
      if (period === 'monthly') {
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString();
      } else if (period === 'yearly') {
        start = new Date(now.getFullYear() - 3, 0, 1).toISOString();
      } else {
        start = new Date(Date.now() - 30 * 86_400_000).toISOString();
      }
      end = now.toISOString();
    }

    // Use orders table for reliable revenue data
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .neq('status', 'cancelled')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const grouped = new Map<string, { label: string; revenue: number; sales_count: number }>();

    for (const row of (orders ?? [])) {
      const d = new Date(row.created_at);
      let key: string;
      if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = String(d.getFullYear());
      } else {
        key = row.created_at.split('T')[0];
      }
      if (!grouped.has(key)) grouped.set(key, { label: key, revenue: 0, sales_count: 0 });
      const e = grouped.get(key)!;
      e.revenue     += Number(row.total_amount ?? 0);
      e.sales_count += 1;
    }

    return Response.json(
      Array.from(grouped.values()).map(r => ({ ...r, revenue: round2(r.revenue) }))
    );
  } catch (err) {
    console.error('analytics/revenue:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
