import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// 6-digit numeric pickup code (100000–999999)
function generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders
// CREATE order, validate stock, decrement stock, generate pickup_code
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items, pickup_time } = req.body as {
      items?: Array<{ product_id: string; quantity: number }>;
      pickup_time?: string;
    };

    if (!items?.length) {
      res.status(400).json({ message: 'items array is required and cannot be empty' });
      return;
    }
    if (!pickup_time) {
      res.status(400).json({ message: 'pickup_time is required' });
      return;
    }
    const pickupDate = new Date(pickup_time);
    if (isNaN(pickupDate.getTime()) || pickupDate <= new Date()) {
      res.status(400).json({ message: 'pickup_time must be a valid future datetime' });
      return;
    }

    // Fetch all products in one query
    const productIds = items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (prodErr) throw prodErr;

    const productMap = new Map(products?.map((p) => [p.id, p]));

    // Validate each item and build order lines
    const orderItems = [];
    let total_amount = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        res.status(400).json({ message: `Product not found: ${item.product_id}` });
        return;
      }
      if (item.quantity < 1) {
        res.status(400).json({ message: `Quantity must be at least 1 for ${product.name}` });
        return;
      }
      if (product.stock < item.quantity) {
        res.status(400).json({
          message: `Only ${product.stock} unit(s) of "${product.name}" left in stock`,
        });
        return;
      }
      orderItems.push({
        product_id:   product.id,
        product_name: product.name,
        quantity:     item.quantity,
        price:        product.price,
      });
      total_amount += product.price * item.quantity;
    }

    const pickup_code = generatePickupCode();

    // INSERT into orders table
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id:  req.user!.id,
        items:        orderItems,
        total_amount: Math.round(total_amount * 100) / 100,
        pickup_time:  pickupDate.toISOString(),
        status:       'pending',
        pickup_code,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // UPDATE product stock (decrement each)
    await Promise.all(
      items.map((item) => {
        const product = productMap.get(item.product_id)!;
        return supabase
          .from('products')
          .update({ stock: product.stock - item.quantity })
          .eq('id', item.product_id);
      })
    );

    // Auto-assign to an on-duty staff member (fire-and-forget)
    const orderId = order.id as string;
    void (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: duties } = await supabase
          .from('staff_duties')
          .select('staff_id')
          .eq('date', today)
          .limit(1);
        if (duties?.length) {
          await supabase
            .from('orders')
            .update({ assigned_staff_id: duties[0].staff_id })
            .eq('id', orderId);
        }
      } catch { /* best-effort */ }
    })();

    res.status(201).json(order);
  } catch (err) {
    console.error('create order:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders
// Customers → SELECT * FROM orders WHERE customer_id = ?
// Managers  → SELECT * FROM orders (all)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = ['manager', 'admin', 'staff'].includes(req.user!.role);

    let query = supabase
      .from('orders')
      .select(isManager ? '*, users(name, email, phone)' : '*')
      .order('created_at', { ascending: false });

    if (!isManager) {
      query = query.eq('customer_id', req.user!.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('get orders:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/my  (customer — explicit alias kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('get my orders:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:id
// Customers can only access their own order; managers can access any.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isManager = ['manager', 'admin', 'staff'].includes(req.user!.role);

    const { data: order, error } = await supabase
      .from('orders')
      .select(isManager ? '*, users(name, email, phone)' : '*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    if (!isManager && order.customer_id !== req.user!.id) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    res.json(order);
  } catch (err) {
    console.error('get order by id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status  (manager)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.body as { status?: string };
      const validStatuses = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];

      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
        return;
      }

      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(updatedOrder);

      // Record analytics when order is completed (fire-and-forget)
      if (status === 'completed' && updatedOrder) {
        void (async () => {
          try {
            const order = updatedOrder as {
              items: Array<{ product_id: string; quantity: number; price: number }>;
              total_amount: number;
              assigned_staff_id?: string;
              created_at: string;
            };
            const today = new Date().toISOString().split('T')[0];
            const analyticsRows = (order.items ?? []).map((item) => ({
              product_id:  item.product_id,
              date:        today,
              sales_count: item.quantity,
              revenue:     Math.round(item.price * item.quantity * 100) / 100,
              staff_id:    order.assigned_staff_id ?? null,
            }));
            if (analyticsRows.length) {
              await supabase.from('analytics').insert(analyticsRows);
            }
          } catch { /* best-effort */ }
        })();
      }
    } catch (err) {
      console.error('update order status:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/verify-pickup  (manager / staff)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/verify-pickup',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { pickup_code } = req.body as { pickup_code?: string };

      if (!pickup_code) {
        res.status(400).json({ message: 'pickup_code is required' });
        return;
      }

      const { data: order, error } = await supabase
        .from('orders')
        .select('*, users(name, email, phone)')
        .eq('pickup_code', pickup_code.trim())
        .maybeSingle();

      if (error) throw error;
      if (!order) {
        res.status(404).json({ message: 'No order found for this pickup code' });
        return;
      }

      res.json(order);
    } catch (err) {
      console.error('verify pickup:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
