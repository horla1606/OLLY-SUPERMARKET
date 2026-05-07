import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
import { sendEmail, productNotificationHtml } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

// GET — return all customers (id, name, email) for the recipient selector
export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'customer')
      .order('name', { ascending: true });
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (err) {
    console.error('admin/notifications customers:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST — send notification; optional `emails` array to restrict recipients
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { title, content, product_id, emails } = await req.json() as {
      title?: string;
      content?: string;
      product_id?: string;
      emails?: string[];
    };

    if (!title?.trim() || !content?.trim()) {
      return Response.json({ message: 'title and content are required' }, { status: 400 });
    }

    let targetEmails: string[];

    if (emails && emails.length > 0) {
      // Use the explicit list provided by the admin
      targetEmails = emails.filter(Boolean);
    } else {
      // Fall back to all customers
      const { data: customers, error: custErr } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'customer');
      if (custErr) throw custErr;
      targetEmails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];
    }

    if (targetEmails.length > 0) {
      await sendEmail({
        to: targetEmails,
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
        sent_count: targetEmails.length,
      })
      .select()
      .single();

    if (notifErr) throw notifErr;
    return Response.json({ ...notif, sent_count: targetEmails.length }, { status: 201 });
  } catch (err) {
    console.error('admin/notifications product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
