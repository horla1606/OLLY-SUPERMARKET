import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const month = new URL(req.url).searchParams.get('month');
    let q = supabase.from('staff_duties').select('*').eq('staff_id', params.id).order('date');
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);

    const { data, error } = await q;
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/staff duties:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
