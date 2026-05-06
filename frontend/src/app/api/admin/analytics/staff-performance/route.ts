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
    const startDate = searchParams.get('start') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const endDate   = searchParams.get('end')   ?? new Date().toISOString().split('T')[0];

    // Step 1: Get all non-cancelled orders in the date range
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('total_amount, created_at')
      .neq('status', 'cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59.999Z');

    if (ordersErr) throw ordersErr;

    // Step 2: Get all staff duty assignments in the date range
    const { data: duties, error: dutiesErr } = await supabase
      .from('staff_duties')
      .select('staff_id, date')
      .gte('date', startDate)
      .lte('date', endDate);

    if (dutiesErr) throw dutiesErr;

    // Build a date → [staff_ids] lookup
    const dutyMap = new Map<string, string[]>();
    for (const d of duties ?? []) {
      const key = d.date as string;
      const existing = dutyMap.get(key) ?? [];
      existing.push(d.staff_id as string);
      dutyMap.set(key, existing);
    }

    // Step 3: Attribute each order's revenue to the staff on duty that day
    const smap = new Map<string, { staff_id: string; name: string; email: string; revenue: number; sales_count: number }>();

    for (const order of orders ?? []) {
      const orderDate = (order.created_at as string).split('T')[0];
      const staffIdsOnDuty = dutyMap.get(orderDate) ?? [];

      for (const staffId of staffIdsOnDuty) {
        if (!smap.has(staffId)) {
          smap.set(staffId, { staff_id: staffId, name: 'Unknown', email: '', revenue: 0, sales_count: 0 });
        }
        const e = smap.get(staffId)!;
        e.revenue     += Number(order.total_amount ?? 0);
        e.sales_count += 1;
      }
    }

    // Step 4: Fetch ALL staff — resolve names and add any with zero attribution
    const { data: allStaff } = await supabase
      .from('staff')
      .select('id, name, email');

    for (const s of allStaff ?? []) {
      const entry = smap.get(s.id as string);
      if (entry) {
        entry.name  = s.name as string;
        entry.email = (s.email ?? '') as string;
      } else {
        smap.set(s.id as string, {
          staff_id:    s.id as string,
          name:        s.name as string,
          email:       (s.email ?? '') as string,
          revenue:     0,
          sales_count: 0,
        });
      }
    }

    return Response.json(
      Array.from(smap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map(s => ({ ...s, revenue: round2(s.revenue) }))
    );
  } catch (err) {
    console.error('analytics/staff-performance:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
