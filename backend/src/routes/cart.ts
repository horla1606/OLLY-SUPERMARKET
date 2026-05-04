import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
}

async function getCartItems(customerId: string): Promise<CartItem[]> {
  const { data } = await supabase
    .from('carts')
    .select('items')
    .eq('customer_id', customerId)
    .maybeSingle();
  return (data?.items as CartItem[]) ?? [];
}

async function saveCartItems(customerId: string, items: CartItem[]) {
  return supabase
    .from('carts')
    .upsert(
      { customer_id: customerId, items, updated_at: new Date().toISOString() },
      { onConflict: 'customer_id' }
    )
    .select()
    .single();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cart
// SELECT * FROM carts WHERE customer_id = ?
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('carts')
      .select('*')
      .eq('customer_id', req.user!.id)
      .maybeSingle();

    if (error) throw error;
    res.json(data ?? { customer_id: req.user!.id, items: [], updated_at: new Date().toISOString() });
  } catch (err) {
    console.error('get cart:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/add
// Add or increment a single product in the cart.
// Body: { product_id, quantity? (default 1) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product_id, quantity = 1 } = req.body as { product_id?: string; quantity?: number };

    if (!product_id) {
      res.status(400).json({ message: 'product_id is required' });
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({ message: 'quantity must be a positive integer' });
      return;
    }

    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, price, image_url, stock')
      .eq('id', product_id)
      .maybeSingle();

    if (prodErr || !product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    if (product.stock === 0) {
      res.status(400).json({ message: `${product.name} is out of stock` });
      return;
    }

    const currentItems = await getCartItems(req.user!.id);
    const existing     = currentItems.find((i) => i.product_id === product_id);
    const newQty       = (existing?.quantity ?? 0) + quantity;

    if (newQty > product.stock) {
      res.status(400).json({
        message: `Only ${product.stock} unit(s) of "${product.name}" available`,
      });
      return;
    }

    const newItems: CartItem[] = existing
      ? currentItems.map((i) => (i.product_id === product_id ? { ...i, quantity: newQty } : i))
      : [
          ...currentItems,
          {
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            quantity,
            image_url: product.image_url ?? null,
          },
        ];

    const { data, error } = await saveCartItems(req.user!.id, newItems);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('cart/add:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/remove
// Remove a single product entirely from the cart.
// Body: { product_id }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/remove', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { product_id } = req.body as { product_id?: string };

    if (!product_id) {
      res.status(400).json({ message: 'product_id is required' });
      return;
    }

    const currentItems = await getCartItems(req.user!.id);
    const newItems     = currentItems.filter((i) => i.product_id !== product_id);

    const { data, error } = await saveCartItems(req.user!.id, newItems);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('cart/remove:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/cart
// Replace entire cart (used for bulk quantity updates).
// Body: { items: [{ product_id, quantity }] }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items } = req.body as { items?: Array<{ product_id: string; quantity: number }> };

    if (!Array.isArray(items)) {
      res.status(400).json({ message: 'items must be an array' });
      return;
    }

    const productIds = items.map((i) => i.product_id);
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .in('id', productIds);

    const productMap = new Map(products?.map((p) => [p.id, p]));
    const enriched: CartItem[] = items
      .filter((i) => productMap.has(i.product_id) && i.quantity > 0)
      .map((i) => {
        const p = productMap.get(i.product_id)!;
        return { product_id: p.id, product_name: p.name, price: p.price, quantity: i.quantity, image_url: p.image_url };
      });

    const { data, error } = await saveCartItems(req.user!.id, enriched);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('cart put:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cart  — clear entire cart
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error } = await supabase
      .from('carts')
      .delete()
      .eq('customer_id', req.user!.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('cart clear:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
