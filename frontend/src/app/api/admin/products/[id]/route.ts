import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
export const dynamic = 'force-dynamic';

async function uploadImage(file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error('Storage upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const contentType = req.headers.get('content-type') ?? '';
    const updates: Record<string, unknown> = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const name = formData.get('name') as string | null;
      const category = formData.get('category') as string | null;
      const price = formData.get('price') as string | null;
      const stock = formData.get('stock') as string | null;
      const expiry_date = formData.get('expiry_date') as string | null;
      const imageFile = formData.get('image') as File | null;

      if (name !== null) updates.name = name.trim();
      if (category !== null) updates.category = category.trim();
      if (price !== null) updates.price = parseFloat(price);
      if (stock !== null) updates.stock = parseInt(stock, 10);
      if (expiry_date !== null) updates.expiry_date = expiry_date?.trim() || null;
      if (imageFile && imageFile.size > 0) {
        const url = await uploadImage(imageFile);
        if (url) updates.image_url = url;
      }
    } else {
      const body = await req.json() as Record<string, unknown>;
      const allowed = ['name', 'category', 'price', 'stock', 'expiry_date', 'image_url'];
      for (const [k, v] of Object.entries(body)) {
        if (allowed.includes(k)) updates[k] = v;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ message: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('admin/update product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { error } = await supabase.from('products').delete().eq('id', params.id);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('admin/delete product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
