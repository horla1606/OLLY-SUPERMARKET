import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
import { sendEmail, productNotificationHtml } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { title, content, product_id } = await req.json() as {
      title?: string; content?: string; product_id?: string;
    };

    if (!title?.trim() || !content?.trim()) {
      return Response.json({ message: 'title and content are required' }, { status: 400 });
    }

    const { data: customers, error: custErr } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'customer');

    if (custErr) throw custErr;

    const emails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];

    if (emails.length > 0) {
      await sendEmail({
        to: emails,
        subject: title.trim(),
        html: productNotificationHtml({ title: title.trim(), content: content.trim() }),
      });
    }

    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        type: 'product',
        title: title.trim(),
        content: content.trim(),
        product_id: product_id || null,
        sent_count: emails.length,
      })
      .select()
      .single();

    if (notifErr) throw notifErr;
    return Response.json({ ...notif, sent_count: emails.length }, { status: 201 });
  } catch (err) {
    console.error('admin/notifications product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
