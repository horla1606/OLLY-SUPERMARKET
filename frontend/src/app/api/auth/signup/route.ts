import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { issueToken } from '@/lib/auth-server';

const SAFE_FIELDS = 'id, email, name, phone, role, created_at';

export async function POST(req: NextRequest) {
  try {
    const { email, name, phone } = await req.json();

    if (!email?.trim() || !name?.trim()) {
      return Response.json({ message: 'email and name are required' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: emailLower, name: name.trim(), phone: phone?.trim() ?? null, role: 'customer' })
      .select(SAFE_FIELDS)
      .single();

    if (error) throw error;

    const token = await issueToken(user);
    return Response.json({ token, user }, { status: 201 });
  } catch (err) {
    console.error('signup:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
