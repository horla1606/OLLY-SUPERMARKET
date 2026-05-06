import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const messages = msgs ?? [];
    const customerIds = Array.from(new Set(messages.map((m) => (m as Record<string, string>).customer_id).filter(Boolean)));
    let userMap: Record<string, unknown> = {};
    if (customerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', customerIds);
      if (users) userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    }

    const enriched = messages.map((m) => ({
      ...m,
      users: userMap[(m as Record<string, string>).customer_id] ?? null,
    }));

    return Response.json(enriched);
  } catch (err) {
    console.error('admin/messages get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
