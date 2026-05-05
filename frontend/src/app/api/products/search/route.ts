import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (!q) return Response.json([]);

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .gt('stock', 0)
      .ilike('name', `%${q}%`)
      .order('name');

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('search products:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
