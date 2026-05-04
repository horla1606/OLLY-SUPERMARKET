import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const adminOnly = [authMiddleware, requireRole('admin')];

// GET /api/staff
router.get('/', ...adminOnly, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('get staff:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/staff
router.post('/', ...adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, hire_date } = req.body as {
      name?: string; email?: string; phone?: string; hire_date?: string;
    };

    if (!name || !email || !hire_date) {
      res.status(400).json({ message: 'name, email, and hire_date are required' });
      return;
    }

    const { data, error } = await supabase
      .from('staff')
      .insert({ name, email: email.toLowerCase(), phone: phone || null, hire_date })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('create staff:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/staff/:id
router.put('/:id', ...adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['name', 'phone', 'hire_date'];
    const updates = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'No valid fields to update' });
      return;
    }

    const { data, error } = await supabase
      .from('staff')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('update staff:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/staff/:id
router.delete('/:id', ...adminOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('staff').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('delete staff:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
