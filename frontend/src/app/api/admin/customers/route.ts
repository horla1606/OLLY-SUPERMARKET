import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const q = new URL(req.url).searchParams.get('q')?.trim();

    let query = supabase
      .from('users')
      .select('id, email, name, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('admin/customers:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
