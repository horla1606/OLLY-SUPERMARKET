import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/products  (public)
// Supports: ?category=&search=&q= (q is alias for search) &sort=price_asc|price_desc|name
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, q, sort } = req.query as {
      category?: string; search?: string; q?: string; sort?: string;
    };
    const term = (q ?? search ?? '').trim();

    // Only show products that are in stock
    let query = supabase.from('products').select('*').gt('stock', 0);

    if (category) query = query.eq('category', category);
    if (term)     query = query.ilike('name', `%${term}%`);

    // Sorting
    if (sort === 'price_asc')  query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else query = query.order('name', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('get products:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/products/search?q=  (public — explicit search endpoint)
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string) ?? '').trim();
    if (!q) { res.json([]); return; }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock', 0)
      .ilike('name', `%${q}%`)
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('search products:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/products/:id  (public)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(data);
  } catch (err) {
    console.error('get product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/products  (manager)
router.post(
  '/',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, category, price, stock, expiry_date, image_url } = req.body as {
        name?: string; category?: string; price?: number;
        stock?: number; expiry_date?: string; image_url?: string;
      };

      if (!name || !category || price === undefined) {
        res.status(400).json({ message: 'name, category, and price are required' });
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .insert({ name, category, price, stock: stock ?? 0, expiry_date: expiry_date || null, image_url: image_url || null })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (err) {
      console.error('create product:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/products/:id  (manager)
router.put(
  '/:id',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const allowed = ['name', 'category', 'price', 'stock', 'expiry_date', 'image_url'];
      const updates = Object.fromEntries(
        Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
      );

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ message: 'No valid fields to update' });
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
      console.error('update product:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/products/:id  (manager only)
router.delete(
  '/:id',
  authMiddleware,
  requireRole('manager', 'admin'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;
      res.status(204).send();
    } catch (err) {
      console.error('delete product:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
