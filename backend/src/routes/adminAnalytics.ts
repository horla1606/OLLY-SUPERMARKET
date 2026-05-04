import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const mgr    = [authMiddleware, requireRole('manager', 'admin', 'staff')];

type Row = Record<string, unknown>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sumField(rows: Row[], field: string): number {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', ...mgr, async (_req: Request, res: Response): Promise<void> => {
  try {
    const now  = new Date();
    const y    = now.getFullYear();
    const m    = now.getMonth();

    const thisMonthStart = new Date(y, m, 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(y, m - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd   = new Date(y, m, 0).toISOString().split('T')[0];
    const ago30          = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];

    const [allRes, thisRes, lastRes, top30Res] = await Promise.all([
      supabase.from('analytics').select('revenue, sales_count'),
      supabase.from('analytics').select('revenue, sales_count').gte('date', thisMonthStart),
      supabase.from('analytics').select('revenue, sales_count')
        .gte('date', lastMonthStart).lte('date', lastMonthEnd),
      supabase.from('analytics')
        .select('product_id, revenue, sales_count, products:product_id(name, category)')
        .gte('date', ago30)
        .not('product_id', 'is', null),
    ]);

    for (const r of [allRes, thisRes, lastRes, top30Res]) {
      if (r.error) throw r.error;
    }

    // Aggregate top products
    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();
    for (const row of (top30Res.data ?? []) as Row[]) {
      const pid  = row.product_id as string;
      const prod = row.products as { name: string; category: string } | null;
      if (!pmap.has(pid)) {
        pmap.set(pid, { product_id: pid, name: prod?.name ?? 'Unknown', category: prod?.category ?? '', revenue: 0, sales_count: 0 });
      }
      const e = pmap.get(pid)!;
      e.revenue     += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    const thisRevenue = sumField(thisRes.data as Row[] ?? [], 'revenue');
    const lastRevenue = sumField(lastRes.data as Row[] ?? [], 'revenue');
    const momPct = lastRevenue === 0
      ? null
      : Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 1000) / 10;

    res.json({
      all_time_revenue:   round2(sumField(allRes.data as Row[] ?? [], 'revenue')),
      all_time_sales:     sumField(allRes.data as Row[] ?? [], 'sales_count'),
      this_month_revenue: round2(thisRevenue),
      last_month_revenue: round2(lastRevenue),
      mom_change_pct:     momPct,
      top_products_30d:   Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((p) => ({ ...p, revenue: round2(p.revenue) })),
    });
  } catch (err) {
    console.error('analytics/dashboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/products
// ─────────────────────────────────────────────────────────────────────────────
router.get('/products', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query as Record<string, string>;
    let q = supabase.from('analytics')
      .select('product_id, revenue, sales_count, products:product_id(name, category)')
      .not('product_id', 'is', null);
    if (start) q = q.gte('date', start);
    if (end)   q = q.lte('date', end);

    const { data, error } = await q;
    if (error) throw error;

    const pmap = new Map<string, { product_id: string; name: string; category: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const pid  = row.product_id as string;
      const prod = row.products as { name: string; category: string } | null;
      if (!pmap.has(pid)) {
        pmap.set(pid, { product_id: pid, name: prod?.name ?? 'Unknown', category: prod?.category ?? '', revenue: 0, sales_count: 0 });
      }
      const e = pmap.get(pid)!;
      e.revenue     += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    res.json(
      Array.from(pmap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((p) => ({ ...p, revenue: round2(p.revenue) }))
    );
  } catch (err) {
    console.error('analytics/products:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/revenue
// ?period=daily|monthly|yearly  &start=YYYY-MM-DD  &end=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/revenue', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'monthly';
    const now    = new Date();

    let start = req.query.start as string;
    let end   = req.query.end   as string;

    if (!start || !end) {
      if (period === 'monthly') {
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
      } else if (period === 'yearly') {
        start = new Date(now.getFullYear() - 3, 0, 1).toISOString().split('T')[0];
      } else {
        start = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
      }
      end = now.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('analytics')
      .select('date, revenue, sales_count')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    if (error) throw error;

    const grouped = new Map<string, { label: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const d   = new Date(row.date as string);
      let key: string;
      if (period === 'monthly') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = String(d.getUTCFullYear());
      } else {
        key = row.date as string;
      }
      if (!grouped.has(key)) grouped.set(key, { label: key, revenue: 0, sales_count: 0 });
      const e = grouped.get(key)!;
      e.revenue     += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    res.json(Array.from(grouped.values()).map((r) => ({ ...r, revenue: round2(r.revenue) })));
  } catch (err) {
    console.error('analytics/revenue:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/analytics/manual-entry
// ─────────────────────────────────────────────────────────────────────────────
router.post('/manual-entry', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { product_id, staff_id, date, sales_count, revenue } =
      req.body as Record<string, string | number | undefined>;

    if (!date || sales_count === undefined || revenue === undefined) {
      res.status(400).json({ message: 'date, sales_count, and revenue are required' });
      return;
    }

    const { data, error } = await supabase
      .from('analytics')
      .insert({
        product_id:  product_id || null,
        staff_id:    staff_id   || null,
        date:        String(date),
        sales_count: Number(sales_count),
        revenue:     Number(revenue),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('analytics/manual-entry:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/staff-performance
// ?start=YYYY-MM-DD  &end=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-performance', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const startDate = start ?? new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
    const endDate   = end   ?? new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('analytics')
      .select('staff_id, revenue, sales_count, users:staff_id(name, email)')
      .not('staff_id', 'is', null)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    const smap = new Map<string, { staff_id: string; name: string; email: string; revenue: number; sales_count: number }>();
    for (const row of (data ?? []) as Row[]) {
      const sid  = row.staff_id as string;
      const user = row.users as { name: string; email: string } | null;
      if (!smap.has(sid)) {
        smap.set(sid, { staff_id: sid, name: user?.name ?? 'Unknown', email: user?.email ?? '', revenue: 0, sales_count: 0 });
      }
      const e = smap.get(sid)!;
      e.revenue     += Number(row.revenue ?? 0);
      e.sales_count += Number(row.sales_count ?? 0);
    }

    res.json(
      Array.from(smap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((s) => ({ ...s, revenue: round2(s.revenue) }))
    );
  } catch (err) {
    console.error('analytics/staff-performance:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
