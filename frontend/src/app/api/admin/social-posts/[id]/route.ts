import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const body = await req.json() as Record<string, unknown>;
    const allowed = ['platform', 'content', 'image_url', 'scheduled_date', 'status', 'product_id'];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    if (!Object.keys(updates).length) {
      return Response.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/social-posts update:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { error } = await supabase.from('social_posts').delete().eq('id', params.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('admin/social-posts delete:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
