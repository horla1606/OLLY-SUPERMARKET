import { NextRequest } from 'next/server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

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

async function generateWithAI(prompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mockGenerate(prompt);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful customer service assistant for OLLY Supermarket, a fresh-produce grocery pickup service. Write friendly, concise, professional responses.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });
    const json = await res.json() as { choices: Array<{ message: { content: string } }> };
    return json.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI error, using mock:', err);
    return mockGenerate(prompt);
  }
}

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
    const text = await generateWithAI(fullPrompt);
    return Response.json({ text });
  } catch (err) {
    console.error('admin/generate-message:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
