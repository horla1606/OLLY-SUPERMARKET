import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user);
  if (authErr) return authErr;

  try {
    const { content, type } = await req.json() as { content?: string; type?: string };
    const validTypes = ['inquiry', 'complaint', 'feedback', 'support'];

    if (!content?.trim()) {
      return Response.json({ message: 'content is required' }, { status: 400 });
    }
    if (type && !validTypes.includes(type)) {
      return Response.json({ message: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: user!.id,
        content: content.trim(),
        type: type || 'inquiry',
        status: 'unread',
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('send message:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('get all messages:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
