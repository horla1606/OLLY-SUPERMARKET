import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

const SAFE_FIELDS = 'id, email, name, phone, role, created_at';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const err = guard(user);
  if (err) return err;

  try {
    const { data, error } = await supabase
      .from('users')
      .select(SAFE_FIELDS)
      .eq('id', user!.id)
      .single();

    if (error || !data) {
      return Response.json({ message: 'User not found' }, { status: 404 });
    }
    return Response.json(data);
  } catch (e) {
    console.error('me GET:', e);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await authenticate(req);
  const err = guard(user);
  if (err) return err;

  try {
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (body.name) updates.name = String(body.name).trim();
    if (body.phone !== undefined) updates.phone = String(body.phone).trim();

    if (Object.keys(updates).length === 0) {
      return Response.json({ message: 'Provide name or phone to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user!.id)
      .select(SAFE_FIELDS)
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    console.error('me PUT:', e);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
