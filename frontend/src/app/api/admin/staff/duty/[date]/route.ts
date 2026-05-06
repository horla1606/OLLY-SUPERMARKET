import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data: duties, error } = await supabase
      .from('staff_duties')
      .select('*')
      .eq('date', params.date);

    if (error) throw error;

    const dutyList = duties ?? [];
    const staffIds = Array.from(new Set(dutyList.map((d) => (d as Record<string, string>).staff_id).filter(Boolean)));
    let staffMap: Record<string, unknown> = {};
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, name, email, phone')
        .in('id', staffIds);
      if (staffRows) staffMap = Object.fromEntries(staffRows.map((s) => [s.id, s]));
    }

    return Response.json(dutyList.map((d) => ({
      ...d,
      staff: staffMap[(d as Record<string, string>).staff_id] ?? null,
    })));
  } catch (err) {
    console.error('admin/staff duty by date:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
