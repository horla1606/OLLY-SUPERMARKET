import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { generateUnsubscribeSig } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') ?? '';
  const sig   = searchParams.get('sig')   ?? '';
  const base  = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!email || !sig) {
    return Response.redirect(`${base}/unsubscribe?status=invalid`);
  }

  const expected = generateUnsubscribeSig(email);
  if (sig !== expected) {
    return Response.redirect(`${base}/unsubscribe?status=invalid`);
  }

  try {
    await supabase
      .from('users')
      .update({ notifications_opt_out: true })
      .eq('email', email.toLowerCase());

    return Response.redirect(`${base}/unsubscribe?status=success&email=${encodeURIComponent(email)}`);
  } catch (err) {
    console.error('unsubscribe error:', err);
    return Response.redirect(`${base}/unsubscribe?status=error`);
  }
}
