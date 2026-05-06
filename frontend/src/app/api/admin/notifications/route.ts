import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false });

    if (error) throw error;

    const notifications = notifs ?? [];
    const productIds = Array.from(new Set(notifications.map((n) => (n as Record<string, string>).product_id).filter(Boolean)));
    let productMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      if (products) productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
    }

    return Response.json(notifications.map((n) => ({
      ...n,
      products: (n as Record<string, string>).product_id
        ? { name: productMap[(n as Record<string, string>).product_id] ?? 'Unknown' }
        : null,
    })));
  } catch (err) {
    console.error('admin/notifications get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
