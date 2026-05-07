import { NextRequest } from 'next/server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

// ── Improved mock ─────────────────────────────────────────────────────────────
// Uses the actual prompt text and random variant selection so output varies.
function mockGenerate(prompt: string, context: string): string {
  const lower = prompt.toLowerCase();
  const ctxLower = context.toLowerCase();

  const isTwitter   = ctxLower.includes('twitter');
  const isInstagram = ctxLower.includes('instagram');
  const isFacebook  = ctxLower.includes('facebook');

  const hashtags = isTwitter
    ? ' #OLLYSupermarket #FreshProduce #Nigeria'
    : isInstagram
    ? ' #OLLYSupermarket #FreshAndFast #Nigeria #Supermarket #Grocery'
    : isFacebook
    ? ' #OLLYSupermarket #ShopFresh'
    : '';

  const rand = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (lower.includes('discount') || lower.includes('promo') || lower.includes('deal') || lower.includes('sale') || lower.includes('%')) {
    return rand([
      `🛒 Big savings at OLLY Supermarket! ${prompt.trim()} Don't miss out — shop now and pick up your order today!${hashtags}`,
      `💰 Your favourite products, now at even better prices. ${prompt.trim()} Visit OLLY Supermarket before it's gone!${hashtags}`,
      `🎉 Special offer alert! ${prompt.trim()} Head to OLLY Supermarket for fresh groceries at unbeatable prices. Order now!${hashtags}`,
    ]);
  }

  if (lower.includes('new') || lower.includes('arrived') || lower.includes('stock') || lower.includes('fresh') || lower.includes('restock')) {
    return rand([
      `🆕 Fresh stock just in at OLLY Supermarket! ${prompt.trim()} Order now and pick up same day!${hashtags}`,
      `✨ Something new is here! ${prompt.trim()} Available now at OLLY Supermarket — quality you can trust.${hashtags}`,
      `🌿 Just restocked and ready for you! ${prompt.trim()} Shop at OLLY Supermarket for the freshest picks.${hashtags}`,
    ]);
  }

  if (lower.includes('holiday') || lower.includes('weekend') || lower.includes('season') || lower.includes('christmas') || lower.includes('eid') || lower.includes('festiv')) {
    return rand([
      `🎊 Celebrate with the best! ${prompt.trim()} Let OLLY Supermarket handle your shopping this season.${hashtags}`,
      `🛍️ Make this occasion special with fresh groceries from OLLY Supermarket. ${prompt.trim()} Order ahead for easy pickup!${hashtags}`,
    ]);
  }

  if (ctxLower.includes('notification')) {
    return rand([
      `Hi there! ${prompt.trim()} Shop the latest at OLLY Supermarket and enjoy hassle-free pickup.`,
      `Good news from OLLY Supermarket! ${prompt.trim()} Visit our shop today and grab what you need.`,
      `We have an update for you! ${prompt.trim()} Order from OLLY Supermarket for fresh groceries picked up fast.`,
    ]);
  }

  // Generic social post
  return rand([
    `🛒 ${prompt.trim()} Come experience freshness and convenience at OLLY Supermarket. Quality you can trust, pickup made easy!${hashtags}`,
    `✅ ${prompt.trim()} OLLY Supermarket brings the freshest groceries right to your fingertips. Order and pick up today!${hashtags}`,
    `🌟 At OLLY Supermarket, we make shopping simple. ${prompt.trim()} Browse, order, and pick up fresh groceries near you.${hashtags}`,
  ]);
}

// ── Claude (Anthropic) ────────────────────────────────────────────────────────
async function generateWithClaude(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'You are a copywriter for OLLY Supermarket, a fresh-produce grocery pickup service in Nigeria. Write friendly, concise, and engaging content. Respond with only the post/message text — no preamble.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = await res.json() as { content?: Array<{ type: string; text: string }> };
    return json.content?.[0]?.text?.trim() ?? '';
  } catch (err) {
    console.error('Anthropic error:', err);
    return '';
  }
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function generateWithOpenAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a copywriter for OLLY Supermarket, a fresh-produce grocery pickup service in Nigeria. Write friendly, concise, and engaging content. Respond with only the post/message text — no preamble.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.9,
      }),
    });
    const json = await res.json() as { choices?: Array<{ message: { content: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    console.error('OpenAI error:', err);
    return '';
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { prompt, context } = await req.json() as { prompt?: string; context?: string };

    if (!prompt?.trim()) {
      return Response.json({ message: 'prompt is required' }, { status: 400 });
    }

    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

    // Try Claude → OpenAI → improved mock
    let text = await generateWithClaude(fullPrompt);
    if (!text) text = await generateWithOpenAI(fullPrompt);
    if (!text) text = mockGenerate(prompt, context ?? '');

    return Response.json({ text });
  } catch (err) {
    console.error('admin/generate-message:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
