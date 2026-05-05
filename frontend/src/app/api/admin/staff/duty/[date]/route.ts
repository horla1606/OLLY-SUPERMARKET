import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('staff_duties')
      .select('*, staff(id, name, email, phone)')
      .eq('date', params.date);

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/staff duty by date:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
