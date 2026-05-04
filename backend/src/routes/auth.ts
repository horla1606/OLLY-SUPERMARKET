import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const SAFE_FIELDS = 'id, email, name, phone, role, created_at';

function issueToken(user: { id: string; email: string; role: string }): string {
  // Map legacy roles to the two canonical runtime roles
  const jwtRole = ['manager', 'admin', 'staff'].includes(user.role) ? 'manager' : 'customer';
  return jwt.sign(
    { id: user.id, email: user.email, role: jwtRole },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
// Customer self-registration: email, name, phone (no password)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, phone } = req.body as {
      email?: string; name?: string; phone?: string;
    };

    if (!email?.trim() || !name?.trim()) {
      res.status(400).json({ message: 'email and name are required' });
      return;
    }

    const emailLower = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: emailLower, name: name.trim(), phone: phone?.trim() ?? null, role: 'customer' })
      .select(SAFE_FIELDS)
      .single();

    if (error) throw error;

    res.status(201).json({ token: issueToken(user), user });
  } catch (err) {
    console.error('signup:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Email-only lookup:
//   manager/admin/staff email → JWT role 'manager'
//   customer email           → JWT role 'customer'
//   not found                → 404 with signup suggestion
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email?.trim()) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select(SAFE_FIELDS)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (!user) {
      res.status(404).json({
        message: 'No account found for this email.',
        suggestion: 'signup',
      });
      return;
    }

    res.json({ token: issueToken(user), user });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// JWT is stateless — client drops the token. We return 200 for clean UX.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the authenticated user's profile from the database.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(SAFE_FIELDS)
      .eq('id', req.user!.id)
      .single();

    if (error || !user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error('me:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/me
// Update name or phone for the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates: Record<string, string> = {};
    if (req.body.name)               updates.name  = (req.body.name as string).trim();
    if (req.body.phone !== undefined) updates.phone = (req.body.phone as string).trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: 'Provide name or phone to update' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user!.id)
      .select(SAFE_FIELDS)
      .single();

    if (error) throw error;
    res.json(user);
  } catch (err) {
    console.error('update me:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Keep /profile as an alias for backward-compatibility during migration
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { data: user } = await supabase.from('users').select(SAFE_FIELDS).eq('id', req.user!.id).single();
  user ? res.json(user) : res.status(404).json({ message: 'User not found' });
});

export default router;
