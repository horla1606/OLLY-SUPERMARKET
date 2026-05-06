import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const platform = new URL(req.url).searchParams.get('platform');
    let q = supabase
      .from('social_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (platform) q = q.eq('platform', platform);

    const { data: posts, error } = await q;
    if (error) throw error;

    const allPosts = posts ?? [];
    const productIds = Array.from(new Set(allPosts.map((p) => (p as Record<string, string>).product_id).filter(Boolean)));
    let productMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      if (products) productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
    }

    return Response.json(allPosts.map((p) => ({
      ...p,
      products: (p as Record<string, string>).product_id
        ? { name: productMap[(p as Record<string, string>).product_id] ?? 'Unknown' }
        : null,
    })));
  } catch (err) {
    console.error('admin/social-posts get:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { platform, content, image_url, scheduled_date, product_id } = await req.json() as Record<string, string>;

    if (!platform || !content?.trim()) {
      return Response.json({ message: 'platform and content are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        platform,
        content: content.trim(),
        image_url: image_url?.trim() || null,
        scheduled_date: scheduled_date || null,
        product_id: product_id || null,
        status: scheduled_date ? 'scheduled' : 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('admin/social-posts create:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
