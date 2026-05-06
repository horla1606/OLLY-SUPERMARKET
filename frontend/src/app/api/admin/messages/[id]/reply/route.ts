import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
import { sendEmail, replyEmailHtml } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { reply } = await req.json();

    if (!reply?.trim()) {
      return Response.json({ message: 'reply text is required' }, { status: 400 });
    }

    const { data: msg, error: fetchErr } = await supabase
      .from('messages')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchErr) throw fetchErr;

    const { data: updated, error: updateErr } = await supabase
      .from('messages')
      .update({ reply: reply.trim(), replied_at: new Date().toISOString(), status: 'replied' })
      .eq('id', params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Fetch customer details separately
    const customerId = (msg as Record<string, string>).customer_id;
    let customer: { name: string; email: string } | null = null;
    if (customerId) {
      const { data: u } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', customerId)
        .maybeSingle();
      customer = u ?? null;
    }
    if (customer?.email) {
      await sendEmail({
        to: customer.email,
        subject: 'OLLY Supermarket — Support Reply',
        html: replyEmailHtml({
          customerName: customer.name,
          originalMessage: (msg as { content: string }).content,
          reply: reply.trim(),
        }),
      });
    }

    return Response.json(updated);
  } catch (err) {
    console.error('admin/messages reply:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
