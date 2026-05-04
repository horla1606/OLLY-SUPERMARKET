import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const staffOrAdmin = [authMiddleware, requireRole('admin', 'staff')];

// GET /api/analytics/dashboard  (admin, staff)
router.get('/dashboard', ...staffOrAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [ordersRes, productsRes, messagesRes, analyticsRes] = await Promise.all([
      supabase.from('orders').select('id, total_amount, status, created_at'),
      supabase.from('products').select('id, name, stock'),
      supabase.from('messages').select('id, status'),
      supabase
        .from('analytics')
        .select('date, sales_count, revenue')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date'),
    ]);

    if (ordersRes.error)   throw ordersRes.error;
    if (productsRes.error) throw productsRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const orders   = ordersRes.data   ?? [];
    const products = productsRes.data ?? [];
    const messages = messagesRes.data ?? [];

    const summary = {
      total_revenue:      orders.filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0),
      total_orders:       orders.length,
      pending_orders:     orders.filter((o) => o.status === 'pending').length,
      low_stock_products: products.filter((p) => p.stock < 10).length,
      unread_messages:    messages.filter((m) => m.status === 'unread').length,
      recent_analytics:   analyticsRes.data ?? [],
    };

    res.json(summary);
  } catch (err) {
    console.error('dashboard analytics:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/product/:id  (admin, staff)
router.get('/product/:id', ...staffOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .eq('product_id', req.params.id)
      .order('date', { ascending: false })
      .limit(90);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('product analytics:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/analytics  (admin, staff) — record a sale
router.post('/', ...staffOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product_id, sales_count, revenue, date } = req.body as {
      product_id?: string; sales_count?: number; revenue?: number; date?: string;
    };

    if (!product_id || sales_count === undefined || revenue === undefined) {
      res.status(400).json({ message: 'product_id, sales_count, and revenue are required' });
      return;
    }

    const recordDate = date ?? new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('analytics')
      .upsert(
        {
          product_id,
          date:        recordDate,
          sales_count,
          revenue,
          staff_id:    req.user!.id,
        },
        { onConflict: 'product_id,date,staff_id' }
      )
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('record analytics:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
