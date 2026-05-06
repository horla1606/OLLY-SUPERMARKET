import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: { date: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { error } = await supabase
      .from('staff_duties')
      .delete()
      .eq('date', params.date);
    if (error) throw error;
    return Response.json({ cleared: true, date: params.date });
  } catch (err) {
    console.error('admin/staff duty clear date:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

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

    // Deduplicate by staff_id — old rows may exist before the DELETE+INSERT fix
    const seen = new Set<string>();
    const unique = dutyList.filter((d) => {
      const sid = (d as Record<string, string>).staff_id;
      if (!sid || seen.has(sid)) return false;
      seen.add(sid);
      return true;
    });

    const staffIds = Array.from(seen);
    let staffMap: Record<string, unknown> = {};
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, name, email, phone')
        .in('id', staffIds);
      if (staffRows) staffMap = Object.fromEntries(staffRows.map((s) => [s.id, s]));
    }

    return Response.json(unique.map((d) => ({
      ...d,
      staff: staffMap[(d as Record<string, string>).staff_id] ?? null,
    })));
  } catch (err) {
    console.error('admin/staff duty by date:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
