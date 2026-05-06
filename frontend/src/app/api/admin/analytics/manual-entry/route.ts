import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

const CREATE_TABLE_SQL = `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS analytics (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  uuid,
  staff_id    uuid,
  date        date NOT NULL,
  sales_count integer DEFAULT 0,
  revenue     numeric(10,2) DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);`;

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
        product_id:  product_id || null,
        staff_id:    staff_id   || null,
        date:        String(date),
        sales_count: Number(sales_count),
        revenue:     Number(revenue),
      })
      .select()
      .single();

    // Any error here almost certainly means the analytics table doesn't exist.
    // Return a helpful message with the SQL to create it.
    if (error) {
      return Response.json({
        message: `The analytics table does not exist in your Supabase database.\n\n${CREATE_TABLE_SQL}`,
      }, { status: 422 });
    }

    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('analytics/manual-entry:', err);
    return Response.json({
      message: `Failed to save entry. The analytics table may not exist.\n\n${CREATE_TABLE_SQL}`,
    }, { status: 500 });
  }
}
