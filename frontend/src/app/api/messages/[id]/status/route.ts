import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { status } = await req.json();
    const validStatuses = ['unread', 'read', 'replied', 'closed'];

    if (!status || !validStatuses.includes(status)) {
      return Response.json({ message: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('update message status:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
