import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const today = new Date().toISOString().split('T')[0];
    const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', in90Days)
      .order('expiry_date', { ascending: true });

    if (error) throw error;

    const annotated = (data ?? []).map((p) => ({
      ...p,
      days_until_expiry: Math.ceil(
        (new Date(p.expiry_date).getTime() - new Date(today).getTime()) / 86_400_000
      ),
    }));

    return Response.json(annotated);
  } catch (err) {
    console.error('admin/expiring:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
