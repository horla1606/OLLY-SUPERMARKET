import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { issueToken } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

const SAFE_FIELDS = 'id, email, name, phone, role, created_at';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return Response.json({ message: 'email is required' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select(SAFE_FIELDS)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (!user) {
      return Response.json(
        { message: 'No account found for this email.', suggestion: 'signup' },
        { status: 404 }
      );
    }

    const token = await issueToken(user);
    return Response.json({ token, user });
  } catch (err) {
    console.error('login:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
