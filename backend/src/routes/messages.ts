import { Router, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/messages  (customer)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content, type } = req.body as { content?: string; type?: string };
    const validTypes = ['inquiry', 'complaint', 'feedback', 'support'];

    if (!content?.trim()) {
      res.status(400).json({ message: 'content is required' });
      return;
    }
    if (type && !validTypes.includes(type)) {
      res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: req.user!.id,
        content:     content.trim(),
        type:        type || 'inquiry',
        status:      'unread',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('send message:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/messages/my  (customer)
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('get my messages:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/messages  (admin, staff)
router.get(
  '/',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error('get all messages:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /api/messages/:id/status  (admin, staff)
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole('manager', 'admin', 'staff'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status } = req.body as { status?: string };
      const validStatuses = ['unread', 'read', 'replied', 'closed'];

      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .update({ status })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error('update message status:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
