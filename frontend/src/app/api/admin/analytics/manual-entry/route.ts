import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { product_id, staff_id, date, sales_count, revenue } = await req.json() as Record<string, string | number | undefined>;

    if (!date || sales_count === undefined || revenue === undefined) {
      return Response.json({ message: 'date, sales_count, and revenue are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('analytics')
      .insert({
        product_id: product_id || null,
        staff_id: staff_id || null,
        date: String(date),
        sales_count: Number(sales_count),
        revenue: Number(revenue),
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('analytics/manual-entry:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
