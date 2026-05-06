import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { date, action } = await req.json() as { date?: string; action?: 'assign' | 'remove' };

    if (!date || !action) {
      return Response.json({ message: 'date and action are required' }, { status: 400 });
    }

    if (action === 'remove') {
      const { error } = await supabase
        .from('staff_duties')
        .delete()
        .eq('staff_id', params.id)
        .eq('date', date);
      if (error) throw error;
      return Response.json({ removed: true, date });
    }

    // assign: delete any existing entries first (prevents duplicates without
    // requiring a UNIQUE constraint in the database), then insert fresh
    await supabase
      .from('staff_duties')
      .delete()
      .eq('staff_id', params.id)
      .eq('date', date);

    const { data, error } = await supabase
      .from('staff_duties')
      .insert({ staff_id: params.id, date })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/staff duty toggle:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
