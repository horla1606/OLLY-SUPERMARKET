import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/staff get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { name, email, phone, hire_date } = await req.json() as Record<string, string>;

    if (!name?.trim() || !email?.trim() || !hire_date) {
      return Response.json({ message: 'name, email, and hire_date are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('staff')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        hire_date,
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('admin/staff create:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
