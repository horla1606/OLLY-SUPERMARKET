import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [customersRes, ordersCountRes, revenueRes, pendingRes, lowStockRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
      supabase.from('orders').select('total_amount').gte('created_at', thirtyDaysAgo),
      supabase.from('orders').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).lt('stock', 10),
    ]);

    if (customersRes.error) throw customersRes.error;
    if (ordersCountRes.error) throw ordersCountRes.error;
    if (revenueRes.error) throw revenueRes.error;
    if (pendingRes.error) throw pendingRes.error;

    // Manually attach user info to pending orders (avoids FK join dependency)
    const pendingOrders = pendingRes.data ?? [];
    const customerIds = Array.from(new Set(pendingOrders.map((o) => (o as Record<string, string>).customer_id).filter(Boolean)));
    let userMap: Record<string, { name: string; email: string; phone: string }> = {};
    if (customerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .in('id', customerIds);
      if (users) {
        userMap = Object.fromEntries(users.map((u) => [u.id, u]));
      }
    }
    const pendingWithUsers = pendingOrders.map((o) => ({
      ...o,
      users: userMap[(o as Record<string, string>).customer_id] ?? null,
    }));

    const revenue30d = (revenueRes.data ?? []).reduce((sum, o) => sum + Number(o.total_amount), 0);

    return Response.json({
      customers: customersRes.count ?? 0,
      orders_30d: ordersCountRes.count ?? 0,
      revenue_30d: Math.round(revenue30d * 100) / 100,
      pending_orders: pendingWithUsers,
      low_stock: lowStockRes.count ?? 0,
    });
  } catch (err) {
    console.error('admin/dashboard:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
