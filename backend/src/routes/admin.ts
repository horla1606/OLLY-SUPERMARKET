import { Router, Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import analyticsRouter from './adminAnalytics';
import messagingRouter from './adminMessaging';
import { sendEmail, productNotificationHtml } from '../lib/email';

const router = Router();

// Multer – keep file in memory, then stream to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const managerOnly = [authMiddleware, requireRole('manager', 'admin', 'staff')];

// Augment AuthRequest so TypeScript knows about req.file
interface AdminRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// ─── Image upload helper ──────────────────────────────────────────────────────
async function uploadImage(file: Express.Multer.File): Promise<string | null> {
  const ext      = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

  if (error) {
    console.error('Storage upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return data.publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', ...managerOnly, async (_req: AdminRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [customersRes, ordersCountRes, revenueRes, pendingRes, lowStockRes] = await Promise.all([
      // SELECT COUNT(*) FROM users WHERE role = 'customer'
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),

      // SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - 30
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),

      // SELECT SUM(total_amount) FROM orders WHERE created_at >= CURRENT_DATE - 30
      supabase.from('orders').select('total_amount').gte('created_at', thirtyDaysAgo),

      // SELECT * FROM orders WHERE status = 'pending'
      supabase
        .from('orders')
        .select('*, users(name, email, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),

      // Low-stock products (stock < 10)
      supabase.from('products').select('id', { count: 'exact', head: true }).lt('stock', 10),
    ]);

    if (customersRes.error)   throw customersRes.error;
    if (ordersCountRes.error) throw ordersCountRes.error;
    if (revenueRes.error)     throw revenueRes.error;
    if (pendingRes.error)     throw pendingRes.error;

    const revenue30d = (revenueRes.data ?? []).reduce(
      (sum, o) => sum + Number(o.total_amount), 0
    );

    res.json({
      customers:      customersRes.count  ?? 0,
      orders_30d:     ordersCountRes.count ?? 0,
      revenue_30d:    Math.round(revenue30d * 100) / 100,
      pending_orders: pendingRes.data    ?? [],
      low_stock:      lowStockRes.count  ?? 0,
    });
  } catch (err) {
    console.error('admin/dashboard:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/products
// Multipart form: name, category, price, stock, expiry_date?, image?
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/products',
  ...managerOnly,
  upload.single('image'),
  async (req: AdminRequest, res: Response): Promise<void> => {
    try {
      const { name, category, price, stock, expiry_date } = req.body as Record<string, string>;

      if (!name?.trim() || !category?.trim() || !price) {
        res.status(400).json({ message: 'name, category, and price are required' });
        return;
      }

      const parsedPrice = parseFloat(price);
      const parsedStock = parseInt(stock ?? '0', 10);

      if (isNaN(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ message: 'price must be a non-negative number' });
        return;
      }

      const image_url = req.file ? await uploadImage(req.file) : null;

      const { data, error } = await supabase
        .from('products')
        .insert({
          name:        name.trim(),
          category:    category.trim(),
          price:       parsedPrice,
          stock:       isNaN(parsedStock) ? 0 : parsedStock,
          expiry_date: expiry_date?.trim() || null,
          image_url,
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);

      // Auto-notify customers about new product (fire-and-forget)
      const newProduct = data as { name: string; category: string; price: number };
      void (async () => {
        try {
          const { data: customers } = await supabase
            .from('users').select('email').eq('role', 'customer');
          const emails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];
          if (!emails.length) return;

          const title   = `New Product: ${newProduct.name}`;
          const content = `${newProduct.name} is now available in our ${newProduct.category} section at ₦${newProduct.price.toLocaleString()}. Order now for fast pickup!`;

          await Promise.all([
            sendEmail({
              to: emails,
              subject: title,
              html: productNotificationHtml({ title, content }),
            }),
            supabase.from('notifications').insert({
              type:       'product',
              title,
              content,
              product_id: (data as { id: string }).id,
              sent_count: emails.length,
            }),
          ]);
        } catch { /* best-effort */ }
      })();
    } catch (err) {
      console.error('admin/create product:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/products/expiring
// SELECT * FROM products WHERE expiry_date <= CURRENT_DATE + 90 days
// (must be registered BEFORE /:id to avoid route shadowing)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/products/expiring', ...managerOnly, async (_req: AdminRequest, res: Response): Promise<void> => {
  try {
    const today           = new Date().toISOString().split('T')[0];
    const in90Days        = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', in90Days)
      .order('expiry_date', { ascending: true });

    if (error) throw error;

    const annotated = (data ?? []).map((p) => ({
      ...p,
      days_until_expiry: Math.ceil(
        (new Date(p.expiry_date).getTime() - new Date(today).getTime()) / 86_400_000
      ),
    }));

    res.json(annotated);
  } catch (err) {
    console.error('admin/expiring:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/products/:id
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  '/products/:id',
  ...managerOnly,
  upload.single('image'),
  async (req: AdminRequest, res: Response): Promise<void> => {
    try {
      const body    = req.body as Record<string, string>;
      const updates: Record<string, unknown> = {};

      if (body.name !== undefined)        updates.name        = body.name.trim();
      if (body.category !== undefined)    updates.category    = body.category.trim();
      if (body.price !== undefined)       updates.price       = parseFloat(body.price);
      if (body.stock !== undefined)       updates.stock       = parseInt(body.stock, 10);
      if (body.expiry_date !== undefined) updates.expiry_date = body.expiry_date?.trim() || null;

      if (req.file) {
        const url = await uploadImage(req.file);
        if (url) updates.image_url = url;
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No fields to update' });
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error('admin/update product:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/products/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/products/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('admin/delete product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/inventory/:id
// UPDATE stock only
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/inventory/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { stock } = req.body as { stock?: unknown };

    if (stock === undefined || stock === null) {
      res.status(400).json({ message: 'stock is required' });
      return;
    }
    const parsed = parseInt(String(stock), 10);
    if (isNaN(parsed) || parsed < 0) {
      res.status(400).json({ message: 'stock must be a non-negative integer' });
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .update({ stock: parsed })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/inventory:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── Sub-routers ──────────────────────────────────────────────────────────────
router.use('/analytics', analyticsRouter);
router.use('/', messagingRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Staff management  (admin panel — manager/admin/staff can access)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/staff
router.get('/staff', ...managerOnly, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('staff').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/staff get:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/admin/staff
router.post('/staff', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, hire_date } = req.body as Record<string, string>;
    if (!name?.trim() || !email?.trim() || !hire_date) {
      res.status(400).json({ message: 'name, email, and hire_date are required' });
      return;
    }
    const { data, error } = await supabase
      .from('staff')
      .insert({ name: name.trim(), email: email.toLowerCase().trim(), phone: phone?.trim() || null, hire_date })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('admin/staff create:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/admin/staff/duty/:date  — must be BEFORE /staff/:id
router.get('/staff/duty/:date', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('staff_duties')
      .select('*, staff(id, name, email, phone)')
      .eq('date', req.params.date);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/staff duty by date:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/admin/staff/:id/duties  — must be BEFORE /staff/:id (3-segment path, no conflict)
router.get('/staff/:id/duties', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };
    let q = supabase.from('staff_duties').select('*').eq('staff_id', req.params.id).order('date');
    if (month) q = q.gte('date', `${month}-01`).lte('date', `${month}-31`);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/staff duties:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/staff/:id/duty
router.patch('/staff/:id/duty', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, action } = req.body as { date?: string; action?: 'assign' | 'remove' };
    if (!date || !action) {
      res.status(400).json({ message: 'date and action are required' });
      return;
    }
    if (action === 'assign') {
      const { data, error } = await supabase
        .from('staff_duties')
        .upsert({ staff_id: req.params.id, date }, { onConflict: 'staff_id,date' })
        .select().single();
      if (error) throw error;
      res.json(data);
    } else {
      const { error } = await supabase
        .from('staff_duties').delete()
        .eq('staff_id', req.params.id).eq('date', date);
      if (error) throw error;
      res.json({ removed: true, date });
    }
  } catch (err) {
    console.error('admin/staff duty toggle:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/staff/:id
router.patch('/staff/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['name', 'phone', 'hire_date'];
    const updates = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) {
      res.status(400).json({ message: 'No valid fields to update' });
      return;
    }
    const { data, error } = await supabase
      .from('staff').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/staff update:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/staff/:id
router.delete('/staff/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('staff').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('admin/staff delete:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/orders/:id/assign-staff
// ─────────────────────────────────────────────────────────────────────────────
router.post('/orders/:id/assign-staff', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { staff_id } = req.body as { staff_id?: string };
    if (!staff_id) {
      res.status(400).json({ message: 'staff_id is required' });
      return;
    }
    const { data, error } = await supabase
      .from('orders').update({ assigned_staff_id: staff_id })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/assign staff to order:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer management routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/customers
router.get('/customers', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query as { q?: string };

    let query = supabase
      .from('users')
      .select('id, email, name, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false });

    if (q?.trim()) {
      query = query.or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('admin/customers:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/admin/customers/:id  — user + their orders
router.get('/customers/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const [userRes, ordersRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, name, phone, created_at')
        .eq('id', req.params.id)
        .eq('role', 'customer')
        .maybeSingle(),
      supabase
        .from('orders')
        .select('*')
        .eq('customer_id', req.params.id)
        .order('created_at', { ascending: false }),
    ]);

    if (userRes.error) throw userRes.error;
    if (!userRes.data) {
      res.status(404).json({ message: 'Customer not found' });
      return;
    }
    if (ordersRes.error) throw ordersRes.error;

    res.json({ customer: userRes.data, orders: ordersRes.data ?? [] });
  } catch (err) {
    console.error('admin/customers/:id:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/customers/:id
router.delete('/customers/:id', ...managerOnly, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id)
      .eq('role', 'customer');
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('admin/customers delete:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
