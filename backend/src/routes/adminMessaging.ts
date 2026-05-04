import { Router, Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { authMiddleware, requireRole } from '../middleware/auth';
import { sendEmail, replyEmailHtml, productNotificationHtml } from '../lib/email';

const router = Router();
const mgr = [authMiddleware, requireRole('manager', 'admin', 'staff')];

// ─── AI message generation helper ────────────────────────────────────────────
async function generateWithAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockGenerate(prompt);
  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful customer service assistant for OLLY Supermarket, a fresh-produce grocery pickup service. Write friendly, concise, professional responses.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      },
      { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
    );
    return (res.data as { choices: Array<{ message: { content: string } }> }).choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI error, using mock:', err);
    return mockGenerate(prompt);
  }
}

function mockGenerate(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('complaint') || lower.includes('issue') || lower.includes('problem')) {
    return 'Thank you for reaching out to OLLY Supermarket. We sincerely apologise for the inconvenience you experienced. Our team is looking into this and will resolve it promptly. We value your patronage and appreciate your patience.';
  }
  if (lower.includes('promo') || lower.includes('discount') || lower.includes('deal') || lower.includes('sale')) {
    return 'Exciting news from OLLY Supermarket! We have fresh deals available for you. Visit our shop today to take advantage of our latest offers on fresh produce and everyday essentials. Enjoy fast, convenient pickup!';
  }
  if (lower.includes('new product') || lower.includes('just arrived') || lower.includes('in stock')) {
    return 'We are thrilled to announce a new addition to OLLY Supermarket! Fresh and carefully selected, this product is now available for pickup. Order now and enjoy our speedy pickup service!';
  }
  return 'Thank you for being a valued OLLY Supermarket customer. We are committed to providing you with the freshest products and the best shopping experience. Visit us today!';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/messages
// Returns all support tickets with customer info, newest first
// ─────────────────────────────────────────────────────────────────────────────
router.get('/messages', ...mgr, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, users:customer_id(id, name, email, phone)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('admin/messages get:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/messages/:id/reply
// ─────────────────────────────────────────────────────────────────────────────
router.post('/messages/:id/reply', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reply } = req.body as { reply?: string };
    if (!reply?.trim()) {
      res.status(400).json({ message: 'reply text is required' });
      return;
    }

    // Fetch message + customer email
    const { data: msg, error: fetchErr } = await supabase
      .from('messages')
      .select('*, users:customer_id(name, email)')
      .eq('id', req.params.id)
      .single();
    if (fetchErr) throw fetchErr;

    // Update message
    const { data: updated, error: updateErr } = await supabase
      .from('messages')
      .update({ reply: reply.trim(), replied_at: new Date().toISOString(), status: 'replied' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    // Send email (no-op if not configured)
    const customer = (msg as Record<string, unknown>).users as { name: string; email: string } | null;
    if (customer?.email) {
      await sendEmail({
        to:      customer.email,
        subject: 'OLLY Supermarket — Support Reply',
        html:    replyEmailHtml({
          customerName:    customer.name,
          originalMessage: (msg as { content: string }).content,
          reply:           reply.trim(),
        }),
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('admin/messages reply:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/messages/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/messages/:id/status', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status?: string };
    const allowed = ['unread', 'read', 'replied', 'closed'];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
      return;
    }
    const { data, error } = await supabase
      .from('messages').update({ status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/messages status:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/generate-message
// Body: { prompt: string; context?: string }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-message', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, context } = req.body as { prompt?: string; context?: string };
    if (!prompt?.trim()) {
      res.status(400).json({ message: 'prompt is required' });
      return;
    }
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    const text = await generateWithAI(fullPrompt);
    res.json({ text });
  } catch (err) {
    console.error('admin/generate-message:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/notifications
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notifications', ...mgr, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, products:product_id(name)')
      .order('sent_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('admin/notifications get:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/notifications/product
// Emails all customers and records a notification entry
// Body: { title, content, product_id? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/notifications/product', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, product_id } = req.body as {
      title?: string; content?: string; product_id?: string;
    };

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ message: 'title and content are required' });
      return;
    }

    // Fetch all customer emails
    const { data: customers, error: custErr } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'customer');
    if (custErr) throw custErr;

    const emails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];

    // Send emails (no-op if not configured)
    if (emails.length > 0) {
      await sendEmail({
        to:      emails,
        subject: title.trim(),
        html:    productNotificationHtml({ title: title.trim(), content: content.trim() }),
      });
    }

    // Record notification
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        type:       'product',
        title:      title.trim(),
        content:    content.trim(),
        product_id: product_id || null,
        sent_count: emails.length,
      })
      .select()
      .single();
    if (notifErr) throw notifErr;

    res.status(201).json({ ...notif, sent_count: emails.length });
  } catch (err) {
    console.error('admin/notifications product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Social Posts CRUD
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/social-posts
router.get('/social-posts', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform } = req.query as { platform?: string };
    let q = supabase
      .from('social_posts')
      .select('*, products:product_id(name)')
      .order('created_at', { ascending: false });
    if (platform) q = q.eq('platform', platform);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    console.error('admin/social-posts get:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/admin/social-posts
router.post('/social-posts', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, content, image_url, scheduled_date, product_id } = req.body as Record<string, string>;

    if (!platform || !content?.trim()) {
      res.status(400).json({ message: 'platform and content are required' });
      return;
    }

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        platform,
        content:        content.trim(),
        image_url:      image_url?.trim() || null,
        scheduled_date: scheduled_date || null,
        product_id:     product_id || null,
        status:         scheduled_date ? 'scheduled' : 'draft',
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('admin/social-posts create:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/social-posts/:id
router.patch('/social-posts/:id', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['platform', 'content', 'image_url', 'scheduled_date', 'status', 'product_id'];
    const updates = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) {
      res.status(400).json({ message: 'No valid fields to update' });
      return;
    }
    const { data, error } = await supabase
      .from('social_posts').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('admin/social-posts update:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/social-posts/:id
router.delete('/social-posts/:id', ...mgr, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('social_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('admin/social-posts delete:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
